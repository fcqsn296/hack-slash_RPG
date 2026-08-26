"""NovelAI で立ち絵を生成するツール。

── APIキーの扱い ──
永続トークンは環境変数 NOVELAI_API_TOKEN から読む。このファイルにも履歴にも残さない。

    # PowerShell
    $env:NOVELAI_API_TOKEN = "pst-xxxxxxxx"
    # bash
    export NOVELAI_API_TOKEN=pst-xxxxxxxx

── 提供元への負荷について ──
リクエストは必ず1件ずつ順番に投げ、既定で 10 秒あけて次へ進む（--delay で変えられるが
MIN_DELAY 未満にはできない）。429 や 5xx が返ったら待ち時間を倍にして数回まで再試行する。
まとめて生成するときも同時接続は 1 のまま。

── 拡張への追従 ──
生成対象は data/enemies.js と data/characters.js から読む。プロンプトは data/artprompts.js
から引き、個別指定が無ければ属性やボス判定から自動で組み立てる。
つまり敵を1体足すだけで、この道具でも生成できる状態になる。

使い方:
    python tools/novelai_gen.py em_slime               1体を1枚
    python tools/novelai_gen.py em_slime --count 4     候補を4枚
    python tools/novelai_gen.py --missing enemy        画像が無い敵をまとめて
    python tools/novelai_gen.py em_slime --add "cute, smiling"     タグを足して調整
    python tools/novelai_gen.py --pick em_slime        候補から選ぶ画面を開く
    python tools/novelai_gen.py em_slime --dry-run     送信せずプロンプトだけ確認

生成した画像は enemies_image/generated/<ID>/ に貯まる。
気に入ったものを --pick か --install で assets/ へ入れる。
"""
import argparse

import contentscan
import io
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_images import ROOT, DATA, load_targets, install, check_size  # noqa: E402

# ---------------------------------------------------------------- 設定

API_URL = "https://image.novelai.net/ai/generate-image"
#: 契約の確認用。画像を作らないので Anlas を消費しない。
# 契約情報も **画像側のホスト** から取る。
#
# api.novelai.net だと 400 で
#   "Please refresh NovelAI.net. If using a third-party tool, update to the image URL."
# が返る。文面は画像URLの話に見えるが、user 系のパスでも同じ扱いになっている。
# 経路そのものは生きていて（認証を外すと 401、存在しないパスは 404）、
# ホストを image.novelai.net に替えるだけで 200 が返る。
SUBSCRIPTION_URL = "https://image.novelai.net/user/subscription"
MODEL = "nai-diffusion-4-5-full"

#: これを外すと必ず失敗する。
#:
#: urllib の既定 User-Agent（Python-urllib/3.x）は NovelAI の前段にいる Cloudflare に
#: 弾かれ、HTTP 403 / error code 1010 が返る。実測:
#:     既定UA        -> 403  "error code: 1010"（Cloudflare が返す。API まで届いていない）
#:     ブラウザ風UA  -> 401  {"statusCode":401,...}（API に届いた上での認証エラー）
#: 同じ症状は assets/ui/ の素材を取得したときにも起きている。消さないこと。
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

#: 既定の待ち時間（秒）。提供元に負荷をかけないための間隔。
DEFAULT_DELAY = 10.0
#: これより短くはできない。
MIN_DELAY = 3.0
#: 429 / 5xx のときの再試行回数
MAX_RETRIES = 4
#: 1回の実行で投げられる上限。事故で大量送信しないための歯止め。
MAX_REQUESTS = 40

#: 候補の置き場所
CANDIDATE_DIR = os.path.join(ROOT, "enemies_image", "generated")
#: 手で調整したプロンプトの保存先
OVERRIDE_PATH = os.path.join(ROOT, "enemies_image", "prompt_overrides.json")


# ---------------------------------------------------------------- プロンプト

def _strip_comments(text):
    """行コメントだけ落とす。文字列中の // は扱わないので、データ側で使わないこと。"""
    return re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)


def _join_strings(chunk):
    """`'a' + 'b' + 'c'` のような連結を1つの文字列にする。"""
    return "".join(re.findall(r"'([^']*)'", chunk))


def _parse_block(text, key):
    """`key: { … }` の中身を取り出す。入れ子は想定しない。"""
    m = re.search(key + r":\s*\{", text)
    if not m:
        return {}
    depth = 0
    start = m.end() - 1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                body = text[start + 1:i]
                break
    else:
        return {}

    out = {}
    for em in re.finditer(r"(\w+):\s*((?:'[^']*'\s*\+?\s*)+),", body):
        out[em.group(1)] = _join_strings(em.group(2))
    return out


def load_prompt_catalog():
    text = _strip_comments(open(os.path.join(DATA, "artprompts.js"), encoding="utf-8").read())

    negative = re.search(r"negative:\s*((?:'[^']*'\s*\+?\s*)+),", text)
    boss = re.search(r"bossTags:\s*((?:'[^']*'\s*\+?\s*)+),", text)
    return {
        "base": _parse_block(text, "base"),
        "subject": _parse_block(text, "subject"),
        "negative": _join_strings(negative.group(1)) if negative else "",
        "elementTags": _parse_block(text, "elementTags"),
        "rarityTags": _parse_block(text, "rarityTags"),
        "bossTags": _join_strings(boss.group(1)) if boss else "",
        "enemies": _parse_block(text, "enemies"),
        "characters": _parse_block(text, "characters"),
    }


def load_overrides():
    if not os.path.exists(OVERRIDE_PATH):
        return {}
    try:
        with open(OVERRIDE_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_override(target_id, prompt):
    data = load_overrides()
    data[target_id] = prompt
    os.makedirs(os.path.dirname(OVERRIDE_PATH), exist_ok=True)
    with open(OVERRIDE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)


def _entry(target):
    """定義そのものを引く。コアと拡張 (§18) の両方から探す。"""
    pool = (contentscan.scan_enemies() if target["kind"] == "エネミー"
            else contentscan.scan_characters())
    return next((e for e in pool if e["id"] == target["id"]), None)


def _meta(target):
    """定義から element / boss / 髪色などを読む。個別プロンプトが無いときに使う。

    コアの data/ と拡張の content/ で書き方が違う（インデントと入れ子）ので、
    切り出しは contentscan に任せて、ここは読むだけにしてある。
    """
    entry = _entry(target)
    if not entry:
        return {"element": "none", "boss": False, "hair": None, "rarity": None}
    return {
        "element": contentscan.field_of(entry, "element") or "none",
        "boss": contentscan.is_boss(entry),
        "hair": contentscan.field_of(entry, "hair"),
        # レアリティごとの味付け (§1.3) に使う。味方だけが持つ。
        "rarity": contentscan.field_of(entry, "rarity"),
    }


#: 自動合成でキャラの髪型タグに使う対応表。data 側に無い値はそのまま英語として出す。
HAIR_TAGS = {
    "hime": "hime cut, long straight hair",
    "long": "long hair",
    "short": "short hair",
    "crop": "short cropped hair",
    "bob": "bob cut",
    "twin": "twintails",
    "ponytail": "ponytail",
    "wavy": "wavy long hair",
    "braid": "braided hair",
}


def build_prompt(target, catalog, overrides, extra=""):
    """その取り込み先に使うプロンプトを決める。

    優先順位:
        overrides（手で調整したもの）
        → 定義に書かれた artPrompt（拡張コンテンツ §18 はここに書く）
        → artprompts.js の個別指定（コアの分）
        → 自動合成

    拡張を artprompts.js より先に見るのは、**拡張が data/ を書き換えない**
    という約束を保つため。拡張の絵の指定は拡張ファイルの中で完結する。

    主語（1girl / 1boy / monster girl）は、個別プロンプトが自分で宣言していない
    ときだけ subject から補う。主人公だけ男性という前提と矛盾させないため。
    """
    tid = target["id"]
    is_enemy = target["kind"] == "エネミー"
    kind = "enemy" if is_enemy else "character"

    entry = _entry(target)
    inline = contentscan.art_prompt(entry) if entry else None

    if tid in overrides:
        detail = overrides[tid]
    elif inline:
        detail = inline
    else:
        table = catalog["enemies"] if is_enemy else catalog["characters"]
        if tid in table:
            detail = table[tid]
        else:
            # 個別指定が無い場合の自動合成。データを足した直後でもこれで生成できる。
            meta = _meta(target)
            parts = []
            if not is_enemy and meta["hair"]:
                parts.append(HAIR_TAGS.get(meta["hair"], meta["hair"] + " hair"))
            parts.append(catalog["elementTags"].get(meta["element"], ""))
            if meta["boss"]:
                parts.append(catalog["bossTags"])
            detail = ", ".join(p for p in parts if p)

    # 既に性別を名指ししているなら、こちらからは足さない
    declares_subject = re.search(r"\b(1boy|1girl|male focus)\b", detail)
    subject = "" if declares_subject else catalog["subject"].get(kind, "")

    # レアリティごとの味付け (§1.3)。高レアほど華やかになるようにする。
    #
    # ── なぜ土台に置かず、ここで足すのか ──
    # base.character に入れると主人公（男性）にも掛かる。
    # レアリティは data/ から読めるので、ここで引いて足すのがいちばん薄い。
    # 男性を名乗っているプロンプトには付けない。
    rarity_tag = ""
    if not is_enemy and not declares_subject:
        rarity = (_meta(target) or {}).get("rarity")
        rarity_tag = (catalog.get("rarityTags") or {}).get(rarity, "")

    pieces = [p for p in (subject, catalog["base"].get(kind, ""), rarity_tag, detail, extra) if p]
    return ", ".join(pieces)


# ---------------------------------------------------------------- API

class RateLimiter:
    """必ず1件ずつ、一定の間隔をあけて投げるための小道具。"""

    def __init__(self, delay):
        self.delay = max(MIN_DELAY, float(delay))
        self.last = 0.0

    def wait(self):
        gap = time.time() - self.last
        if self.last and gap < self.delay:
            remain = self.delay - gap
            print("    次のリクエストまで %.1f 秒待ちます…" % remain)
            time.sleep(remain)
        self.last = time.time()


def generate(token, prompt, negative, seed, limiter, width, height, steps, scale):
    """1枚生成して PNG のバイト列を返す。"""
    parameters = {
        "params_version": 3,
        "width": width, "height": height,
        "scale": scale, "sampler": "k_euler_ancestral", "steps": steps,
        "seed": seed, "n_samples": 1,
        "ucPreset": 0, "qualityToggle": True,
        "sm": False, "sm_dyn": False,
        "dynamic_thresholding": False,
        "controlnet_strength": 1.0, "legacy": False, "add_original_image": True,
        "cfg_rescale": 0.0, "noise_schedule": "karras", "legacy_v3_extend": False,
        "uncond_scale": 1.0,
        "negative_prompt": negative, "prompt": prompt,
        "reference_image_multiple": [],
        "reference_information_extracted_multiple": [],
        "reference_strength_multiple": [],
        "extra_noise_seed": seed,
        "v4_prompt": {
            "use_coords": False, "use_order": True,
            "caption": {"base_caption": prompt, "char_captions": []},
        },
        "v4_negative_prompt": {
            "use_coords": False, "use_order": False,
            "caption": {"base_caption": negative, "char_captions": []},
        },
    }
    payload = json.dumps({
        "input": prompt, "model": MODEL, "action": "generate", "parameters": parameters,
    }).encode("utf-8")

    delay = limiter.delay
    for attempt in range(1, MAX_RETRIES + 1):
        limiter.wait()
        req = urllib.request.Request(API_URL, data=payload, method="POST", headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/x-zip-compressed",
            "User-Agent": USER_AGENT,
            "Origin": "https://novelai.net",
            "Referer": "https://novelai.net/",
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                return _extract_png(res.read())
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:600]
            except Exception:
                pass
            # 認証・権限まわりは何度投げても結果が変わらない。再試行せず原因を出す。
            if e.code in (401, 402, 403):
                raise RuntimeError(_auth_error_hint(e, body))
            # 混雑・一時的な不調のときだけ、間隔を広げて待ってから試し直す
            if e.code in (429, 500, 502, 503, 520, 524) and attempt < MAX_RETRIES:
                retry_after = e.headers.get("Retry-After") if e.headers else None
                wait = float(retry_after) if retry_after and retry_after.isdigit() else delay * 2
                delay = wait
                limiter.delay = max(limiter.delay, wait)
                print("    HTTP %d。%.0f 秒待って再試行します（%d/%d）" %
                      (e.code, wait, attempt, MAX_RETRIES))
                time.sleep(wait)
                continue
            raise RuntimeError("APIエラー HTTP %d: %s" % (e.code, body))
        except urllib.error.URLError as e:
            if attempt < MAX_RETRIES:
                print("    接続に失敗しました（%s）。%.0f 秒待って再試行します。" % (e.reason, delay))
                time.sleep(delay)
                delay *= 2
                continue
            raise RuntimeError("接続に失敗しました: %s" % e.reason)
    raise RuntimeError("再試行の上限に達しました")


def _auth_error_hint(err, body):
    """401 / 402 / 403 のときに、何を確かめればよいかまで含めて返す。

    同じ 403 でも「NovelAI が断った」のと「前段の Cloudflare が弾いた」のでは
    直し方が違うので、応答から判別できるところまで出す。
    """
    headers = err.headers or {}
    cf_ray = headers.get("cf-ray")
    server = (headers.get("server") or "").lower()
    looks_like_cloudflare = bool(cf_ray) and (
        "cloudflare" in server or "<html" in body.lower() or "attention required" in body.lower())

    lines = ["APIエラー HTTP %d" % err.code]
    if body:
        lines.append("  応答: " + body.replace("\n", " ")[:400])
    if cf_ray:
        lines.append("  cf-ray: " + cf_ray)

    lines.append("")
    if err.code == 401:
        lines += [
            "  → トークンが受け付けられませんでした。",
            "     NovelAI のアカウント設定で発行する Persistent API Token（pst- で始まる）か確認してください。",
            "     python tools/novelai_gen.py --check  で読めている値の先頭が見られます。",
        ]
    elif err.code == 402:
        lines += [
            "  → 支払い・残高まわりで断られました。",
            "     Anlas の残量とサブスクリプションの状態を確認してください。",
        ]
    elif looks_like_cloudflare:
        lines += [
            "  → NovelAI ではなく前段の Cloudflare に弾かれています。",
            "     しばらく間をあけて試すか、同じ回線から一度ブラウザで novelai.net を開いてから",
            "     もう一度実行してみてください。",
        ]
    else:
        lines += [
            "  → 権限が足りないか、トークンが無効です。次の順で確認してください。",
            "     1. python tools/novelai_gen.py --check  で pst- 始まりか、余計な空白が無いか",
            "     2. トークンを作り直して setx で入れ直す（作り直すと古いものは無効になります）",
            "     3. 使おうとしているモデル（%s）が今の契約で使えるか" % MODEL,
            "     4. ブラウザの NovelAI で同じ設定の生成が通るか",
        ]
    return "\n".join(lines)


def _extract_png(raw):
    """応答は ZIP のことも生のPNGのこともあるので、両方受ける。"""
    if raw[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".png")]
            if not names:
                raise RuntimeError("ZIPの中にPNGがありませんでした")
            return z.read(names[0])
    return raw


# ---------------------------------------------------------------- 候補の管理

def candidate_dir(target_id):
    return os.path.join(CANDIDATE_DIR, target_id)


def list_candidates(target_id):
    d = candidate_dir(target_id)
    if not os.path.isdir(d):
        return []
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".png"))


def save_candidate(target_id, png, prompt, negative, seed):
    d = candidate_dir(target_id)
    os.makedirs(d, exist_ok=True)
    stem = "%d-%s" % (seed, time.strftime("%m%d%H%M%S"))
    path = os.path.join(d, stem + ".png")
    with open(path, "wb") as f:
        f.write(png)
    # どのプロンプトで出たかを残す。あとで再現・微調整するために要る。
    with open(os.path.join(d, stem + ".json"), "w", encoding="utf-8") as f:
        json.dump({"prompt": prompt, "negative": negative, "seed": seed,
                   "model": MODEL}, f, ensure_ascii=False, indent=2)
    return path


def candidate_meta(png_path):
    meta_path = os.path.splitext(png_path)[0] + ".json"
    if not os.path.exists(meta_path):
        return {}
    try:
        with open(meta_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


# ---------------------------------------------------------------- 実行

def resolve_targets(args, targets):
    if args.missing:
        kind = {"enemy": "エネミー", "character": "キャラクター"}.get(args.missing)
        return [t for t in targets if not t["existing"] and (not kind or t["kind"] == kind)]
    picked = []
    for tid in args.ids:
        found = next((t for t in targets if t["id"] == tid), None)
        if not found:
            print("見つからないID:", tid)
            continue
        picked.append(found)
    return picked


def run_generation(args, targets, cfg):
    catalog = load_prompt_catalog()
    overrides = load_overrides()
    chosen = resolve_targets(args, targets)

    if not chosen:
        print("対象がありません。IDを指定するか --missing enemy を使ってください。")
        return 1

    total = len(chosen) * args.count
    if total > MAX_REQUESTS and not args.dry_run:
        print("一度に %d 枚は多すぎます（上限 %d 枚）。--count を減らすか対象を絞ってください。"
              % (total, MAX_REQUESTS))
        return 1

    token = os.environ.get("NOVELAI_API_TOKEN", "").strip()
    if not token and not args.dry_run:
        print("環境変数 NOVELAI_API_TOKEN が設定されていません。")
        print('  PowerShell: $env:NOVELAI_API_TOKEN = "pst-xxxx"')
        print("  bash      : export NOVELAI_API_TOKEN=pst-xxxx")
        return 1

    limiter = RateLimiter(args.delay)
    print("対象 %d 件 × %d 枚 = %d 枚。%.0f 秒間隔で1件ずつ送ります。\n"
          % (len(chosen), args.count, total, limiter.delay))

    # 出力サイズ。既定は立ち絵と同じ縦長。背景では横長にしたいことがある。
    out_w, out_h = cfg["width"], cfg["height"]
    if args.size:
        try:
            _w, _h = args.size.lower().split("x")
            out_w, out_h = int(_w), int(_h)
        except Exception:
            print("--size の書き方が違います。例: 1216x832")
            return

    made = 0
    for t in chosen:
        prompt = args.prompt or build_prompt(t, catalog, overrides, args.add)
        base_neg = args.negative if args.negative is not None else catalog["negative"]
        negative = base_neg + ((", " + args.negative_add) if args.negative_add else "")

        print("[%s] %s" % (t["id"], t["name"]))
        print("  prompt: " + prompt)
        if args.dry_run:
            print("  (--dry-run のため送信しません)\n")
            continue

        for i in range(args.count):
            seed = args.seed if args.seed is not None else random.randint(1, 2 ** 31 - 1)
            try:
                png = generate(token, prompt, negative, seed, limiter,
                               out_w, out_h, args.steps, args.scale)
            except RuntimeError as e:
                print("  失敗: %s" % e)
                break
            path = save_candidate(t["id"], png, prompt, negative, seed)
            made += 1
            print("  %d/%d 保存: %s" % (i + 1, args.count, os.path.relpath(path, ROOT)))

            if args.install and i == 0:
                dest = install(t, path, cfg)
                print("       → %s へ適用しました" % os.path.relpath(dest, ROOT))
        if args.save and not args.dry_run:
            save_override(t["id"], prompt)
            print("  プロンプトを prompt_overrides.json に保存しました")
        print()

    if not args.dry_run:
        print("%d 枚を生成しました。" % made)
        print("候補から選ぶには:  python tools/novelai_gen.py --pick <ID>")
    return 0


# ---------------------------------------------------------------- 候補を選ぶ画面

def run_picker(target_id, targets, cfg, args, parent=None):
    """候補を並べて選び、その場で撮り直しもできる画面。

    parent を渡すと Toplevel として開く（一覧画面から呼ばれる場合）。
    渡さなければ単独のウィンドウとして開いて mainloop まで面倒を見る。
    """
    try:
        import tkinter as tk
        from tkinter import messagebox
    except ImportError:
        print("tkinter が使えません。候補は次の場所にあります:")
        print("  " + candidate_dir(target_id))
        return 1
    try:
        from PIL import Image, ImageTk
    except ImportError:
        msg = ("この画面には Pillow が要ります:  pip install pillow\n"
               "候補は次の場所にあります: " + candidate_dir(target_id))
        if parent is not None:
            from tkinter import messagebox as mb
            mb.showerror("候補を選ぶ", msg)
            return 1
        print(msg)
        return 1

    target = next((t for t in targets if t["id"] == target_id), None)
    if not target:
        print("見つからないID:", target_id)
        return 1

    catalog = load_prompt_catalog()
    root = tk.Toplevel(parent) if parent is not None else tk.Tk()
    root.title("候補を選ぶ — %s（%s）" % (target["name"], target_id))
    root.geometry("900x680")

    state = {"selected": None, "thumbs": [], "frames": []}

    tk.Label(root, text="%s（%s）" % (target["name"], target_id),
             font=("", 12, "bold")).pack(anchor="w", padx=10, pady=(10, 0))
    status = tk.Label(root, text="", anchor="w", justify="left", fg="#888")
    status.pack(fill="x", padx=10)

    canvas_box = tk.Frame(root)
    canvas_box.pack(fill="both", expand=True, padx=10, pady=8)
    canvas = tk.Canvas(canvas_box, highlightthickness=0)
    xbar = tk.Scrollbar(canvas_box, orient="horizontal", command=canvas.xview)
    canvas.configure(xscrollcommand=xbar.set)
    strip = tk.Frame(canvas)
    canvas.create_window((0, 0), window=strip, anchor="nw")
    canvas.pack(side="top", fill="both", expand=True)
    xbar.pack(side="bottom", fill="x")
    strip.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

    tk.Label(root, text="プロンプト（ここを直して「この内容で生成」を押すと撮り直せます）",
             anchor="w").pack(fill="x", padx=10)
    prompt_box = tk.Text(root, height=6, wrap="word")
    prompt_box.pack(fill="x", padx=10)

    def refresh():
        for f in state["frames"]:
            f.destroy()
        state["frames"] = []
        state["thumbs"] = []

        files = list_candidates(target_id)
        current = target["existing"]
        status.config(text="候補 %d 枚%s" % (
            len(files),
            "  ／ 現在の設定: " + os.path.relpath(current, ROOT) if current else "  ／ 未設定"))

        for path in files:
            try:
                im = Image.open(path)
                im.thumbnail((190, 280))
                photo = ImageTk.PhotoImage(im)
            except Exception:
                continue
            state["thumbs"].append(photo)

            frame = tk.Frame(strip, bd=2, relief="flat")
            frame.pack(side="left", padx=5, pady=5)
            lbl = tk.Label(frame, image=photo, cursor="hand2")
            lbl.pack()
            meta = candidate_meta(path)
            tk.Label(frame, text="seed %s" % meta.get("seed", "?"), fg="#888").pack()

            def select(p=path, fr=frame):
                state["selected"] = p
                for f in state["frames"]:
                    f.config(relief="flat", bg=root.cget("bg"))
                fr.config(relief="solid", bg="#c8a24d")
                m = candidate_meta(p)
                if m.get("prompt"):
                    prompt_box.delete("1.0", tk.END)
                    prompt_box.insert("1.0", m["prompt"])

            lbl.bind("<Button-1>", lambda e, s=select: s())
            state["frames"].append(frame)

        if not files:
            state["frames"].append(tk.Label(
                strip, fg="#888",
                text="候補がありません。\n下の「この内容で生成」から作ってください。"))
            state["frames"][-1].pack(padx=20, pady=40)

        if not prompt_box.get("1.0", tk.END).strip():
            prompt_box.insert("1.0", build_prompt(target, catalog, load_overrides()))

    def do_apply():
        if not state["selected"]:
            messagebox.showinfo("採用", "先に候補を1枚選んでください。")
            return
        warn = check_size(state["selected"], cfg)
        if warn and not messagebox.askyesno("サイズが違います", "サイズ %s\nこのまま採用しますか？" % warn):
            return
        dest = install(target, state["selected"], cfg)
        fresh, _ = load_targets()
        target["existing"] = next((t["existing"] for t in fresh if t["id"] == target_id), None)
        refresh()
        messagebox.showinfo("採用", "%s へ適用しました。" % os.path.relpath(dest, ROOT))

    def do_generate():
        token = os.environ.get("NOVELAI_API_TOKEN", "").strip()
        if not token:
            messagebox.showerror("生成", "環境変数 NOVELAI_API_TOKEN が設定されていません。")
            return
        prompt = prompt_box.get("1.0", tk.END).strip()
        if not prompt:
            messagebox.showerror("生成", "プロンプトが空です。")
            return
        count = int(count_var.get())
        limiter = RateLimiter(args.delay)
        negative = catalog["negative"]

        gen_btn.config(state="disabled", text="生成中…")
        root.update()
        made = 0
        try:
            for i in range(count):
                status.config(text="生成中 %d / %d …（%.0f 秒間隔）" % (i + 1, count, limiter.delay))
                root.update()
                seed = random.randint(1, 2 ** 31 - 1)
                png = generate(token, prompt, negative, seed, limiter,
                               cfg["width"], cfg["height"], args.steps, args.scale)
                save_candidate(target_id, png, prompt, negative, seed)
                made += 1
                refresh()
                root.update()
        except RuntimeError as e:
            messagebox.showerror("生成", str(e))
        finally:
            gen_btn.config(state="normal", text="この内容で生成")
            refresh()
        if made:
            messagebox.showinfo("生成", "%d 枚を追加しました。" % made)

    def do_save_prompt():
        prompt = prompt_box.get("1.0", tk.END).strip()
        if not prompt:
            return
        save_override(target_id, prompt)
        messagebox.showinfo("保存", "prompt_overrides.json に保存しました。\n"
                                    "次からこの内容が既定になります。")

    bar = tk.Frame(root)
    bar.pack(fill="x", padx=10, pady=10)
    count_var = tk.StringVar(value="2")
    tk.Label(bar, text="枚数").pack(side="left")
    tk.Spinbox(bar, from_=1, to=8, width=3, textvariable=count_var).pack(side="left", padx=(4, 10))
    gen_btn = tk.Button(bar, text="この内容で生成", command=do_generate, width=16)
    gen_btn.pack(side="left")
    tk.Button(bar, text="プロンプトを保存", command=do_save_prompt, width=16).pack(side="left", padx=6)
    tk.Button(bar, text="選んだ1枚を採用", command=do_apply, width=16).pack(side="right")

    refresh()
    if parent is None:
        root.mainloop()
    return 0


# ---------------------------------------------------------------- キーの確認

def cmd_check():
    """APIキーが読めているかだけを見る。中身は決して表示しない。"""
    raw = os.environ.get("NOVELAI_API_TOKEN")
    if raw is None:
        print("環境変数 NOVELAI_API_TOKEN が見つかりません。")
        print()
        print("この窓だけで一時的に設定する（窓を閉じると消えます）:")
        print('  PowerShell : $env:NOVELAI_API_TOKEN = "pst-xxxx"')
        print("  bash       : export NOVELAI_API_TOKEN=pst-xxxx")
        print()
        print("ずっと残す（.bat のダブルクリックからも読めるようになります）:")
        print('  PowerShell : setx NOVELAI_API_TOKEN "pst-xxxx"')
        print("               ※ 実行後に窓を開き直してください")
        return 1

    token = raw.strip()
    if not token:
        print("NOVELAI_API_TOKEN は設定されていますが、中身が空です。")
        return 1

    # 中身は出さない。長さと先頭だけで、取り違えに気付けるようにする。
    print("NOVELAI_API_TOKEN を読み込めました。")
    print("  長さ %d 文字 / 先頭 %s…" % (len(token), token[:4]))
    if not token.startswith("pst-"):
        print("  ※ NovelAI の永続トークンは通常 'pst-' で始まります。別の値かもしれません。")
    if raw != token:
        print("  ※ 前後に空白が入っています。読み込み時に取り除いて使います。")

    # 契約情報を1回だけ取りに行く。画像は作らないので Anlas は減らない。
    print("\n契約情報を確認しています…")
    req = urllib.request.Request(SUBSCRIPTION_URL, headers={
        "Authorization": "Bearer " + token,
        "User-Agent": USER_AGENT,
        "Origin": "https://novelai.net",
        "Referer": "https://novelai.net/",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            info = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", "replace")[:600]
        except Exception:
            pass
        print(_auth_error_hint(e, body) if e.code in (401, 402, 403)
              else "  確認できませんでした（HTTP %d）: %s" % (e.code, body[:200]))
        return 1
    except urllib.error.URLError as e:
        print("  接続できませんでした: %s" % e.reason)
        return 1

    tier = info.get("tier")
    active = info.get("active")
    points = (info.get("trainingStepsLeft") or {}).get("fixedTrainingStepsLeft")
    print("  トークンは有効です。")
    print("  tier: %s / 有効: %s" % (tier, active))
    if points is not None:
        print("  Anlas 残量: %s" % points)
    if tier is not None and tier < 3:
        print("  ※ tier 3（Opus）未満です。生成のたびに Anlas を消費します。")
    print()
    print("生成を試す:  python tools/novelai_gen.py em_slime --count 1")
    return 0


# ---------------------------------------------------------------- 一覧画面

def run_launcher(targets, cfg, args):
    """引数なしで起動したときの入口。

    ダブルクリックで開かれることを前提にしている。何も表示せずに終わると
    コンソール窓が一瞬で閉じてしまい、原因が分からないため。
    """
    try:
        import tkinter as tk
        from tkinter import messagebox
    except ImportError:
        print("tkinter が使えないため一覧画面を開けません。")
        print("コマンドから使ってください:  python tools/novelai_gen.py em_slime --count 4")
        return 1

    root = tk.Tk()
    root.title("立ち絵の生成 — ハクスラRPG")
    root.geometry("640x600")

    state = {"rows": []}

    header = tk.Label(root, anchor="w", justify="left")
    header.pack(fill="x", padx=10, pady=(10, 4))

    only_missing = tk.BooleanVar(value=True)

    box = tk.Frame(root)
    box.pack(fill="both", expand=True, padx=10)
    listbox = tk.Listbox(box, font=("Consolas", 10))
    bar = tk.Scrollbar(box, command=listbox.yview)
    listbox.config(yscrollcommand=bar.set)
    listbox.pack(side="left", fill="both", expand=True)
    bar.pack(side="right", fill="y")

    def refresh():
        fresh, _ = load_targets()
        listbox.delete(0, tk.END)
        state["rows"] = []
        for t in fresh:
            if only_missing.get() and t["existing"]:
                continue
            state["rows"].append(t)
            n = len(list_candidates(t["id"]))
            listbox.insert(tk.END, "%s  %-16s %-12s %-18s %s" % (
                "○" if t["existing"] else "×", t["id"], t["kind"], t["name"],
                ("候補 %d 枚" % n) if n else ""))

        has_token = bool(os.environ.get("NOVELAI_API_TOKEN", "").strip())
        done = sum(1 for t in fresh if t["existing"])
        header.config(
            text="設定済み %d / %d\n"
                 "APIキー: %s\n"
                 "行を選んで「候補を選ぶ／生成」を押してください。"
                 % (done, len(fresh),
                    "環境変数 NOVELAI_API_TOKEN から読めています"
                    if has_token else
                    "未設定（生成はできません。候補の閲覧と採用のみ可能）"),
            fg="#333" if has_token else "#a05000")

    def open_picker():
        sel = listbox.curselection()
        if not sel:
            messagebox.showinfo("生成", "先に一覧から1行選んでください。")
            return
        target = state["rows"][sel[0]]
        fresh, fresh_cfg = load_targets()
        run_picker(target["id"], fresh, fresh_cfg, args, parent=root)
        refresh()

    listbox.bind("<Double-Button-1>", lambda e: open_picker())

    buttons = tk.Frame(root)
    buttons.pack(fill="x", padx=10, pady=10)
    tk.Button(buttons, text="候補を選ぶ／生成", command=open_picker, width=18).pack(side="left")
    tk.Checkbutton(buttons, text="未設定のみ表示", variable=only_missing,
                   command=refresh).pack(side="left", padx=8)
    tk.Button(buttons, text="閉じる", command=root.destroy, width=8).pack(side="right")

    refresh()
    root.mainloop()
    return 0


# ---------------------------------------------------------------- 入口

def main():
    parser = argparse.ArgumentParser(
        description="NovelAI で立ち絵を生成する",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="APIキーは環境変数 NOVELAI_API_TOKEN から読みます。")
    parser.add_argument("ids", nargs="*", help="生成するキャラ/敵のID")
    parser.add_argument("--missing", choices=["enemy", "character", "all"],
                        help="画像がまだ無いものをまとめて対象にする")
    parser.add_argument("--count", type=int, default=1, help="1体あたりの生成枚数（既定 1）")
    parser.add_argument("--seed", type=int, help="固定したい乱数の種")
    parser.add_argument("--prompt", help="プロンプトを丸ごと差し替える")
    parser.add_argument("--add", default="", help="既定のプロンプトに足すタグ")
    parser.add_argument("--negative-add", default="", help="除外タグに足すもの")
    # 背景を作るときに要る。立ち絵向けの除外タグには scenery / detailed background が
    # 入っていて、そのままだと背景の指示と正面から喧嘩する (§1.3)。
    parser.add_argument("--negative", help="除外タグを丸ごと差し替える（背景を作るとき）")
    parser.add_argument("--size", help="画像サイズ。例 1216x832（既定は立ち絵と同じ縦長）")
    parser.add_argument("--save", action="store_true",
                        help="使ったプロンプトを prompt_overrides.json に保存する")
    parser.add_argument("--install", action="store_true",
                        help="生成した1枚目をそのまま assets/ へ適用する")
    parser.add_argument("--pick", metavar="ID", help="候補から選ぶ画面を開く")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help="リクエストの間隔（秒・既定 %g・下限 %g）" % (DEFAULT_DELAY, MIN_DELAY))
    parser.add_argument("--steps", type=int, default=28, help="ステップ数（既定 28）")
    parser.add_argument("--scale", type=float, default=5.0, help="プロンプトの効き（既定 5.0）")
    parser.add_argument("--dry-run", action="store_true", help="送信せずプロンプトだけ表示する")
    parser.add_argument("--list-prompts", action="store_true", help="全対象のプロンプトを表示する")
    parser.add_argument("--check", action="store_true",
                        help="APIキーが読めているかだけを確認する（キーの中身は表示しない）")
    args = parser.parse_args()

    if args.check:
        return cmd_check()

    targets, cfg = load_targets()

    if args.list_prompts:
        catalog = load_prompt_catalog()
        overrides = load_overrides()
        for t in targets:
            src = ("上書き" if t["id"] in overrides else
                   "個別" if t["id"] in catalog["enemies"] or t["id"] in catalog["characters"]
                   else "自動合成")
            print("\n[%s] %s  (%s)" % (t["id"], t["name"], src))
            print("  " + build_prompt(t, catalog, overrides))
        return 0

    if args.pick:
        return run_picker(args.pick, targets, cfg, args)

    if args.missing == "all":
        args.missing = None
        args.ids = [t["id"] for t in targets if not t["existing"]]

    # 引数なし＝ダブルクリックで開かれた場合。一覧画面を出す。
    if not args.ids and not args.missing:
        return run_launcher(targets, cfg, args)

    return run_generation(args, targets, cfg)


if __name__ == "__main__":
    # ダブルクリックで開かれたときは、失敗しても窓が一瞬で閉じないようにする
    interactive = len(sys.argv) == 1
    try:
        code = main()
    except Exception:
        import traceback
        traceback.print_exc()
        code = 1
    if interactive and code != 0:
        try:
            input("\n何かキーを押すと閉じます…")
        except EOFError:
            pass
    sys.exit(code)
