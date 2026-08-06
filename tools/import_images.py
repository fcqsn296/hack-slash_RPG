"""立ち絵の取り込みミニツール。

キャラクターや敵の画像を、正しいファイル名で assets/ 以下へコピーする。

── 拡張への追従について ──
取り込み先の一覧は data/characters.js と data/enemies.js から読み取る。
保存先フォルダと拡張子の規則は data/art.js から読む。
そのため data/ に1体足せば、このツールにも自動で枠が増える。
このファイルに個別のIDを書かないこと。

使い方:
    python tools/import_images.py
        画面（エクスプローラーのダイアログ）で1体ずつ選んで取り込む

    python tools/import_images.py <フォルダ>
        フォルダ内の画像をファイル名から自動で振り分けて取り込む
        （--dry-run を付けると実際にはコピーせず結果だけ表示する）

    python tools/import_images.py --list
        まだ画像が無いものを一覧表示する
"""
import argparse
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")


# ---------------------------------------------------------------- データの読み取り

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def _parse_catalog(filename, assign_prefix):
    """`RPG.data.xxx = { id: { name: '…' }, … }` から id と name を取り出す。

    JSファイルをそのまま読むので、データを追記すればここも自動で追従する。
    入れ子の中の `name:` を拾わないよう、行頭のインデントが2の定義だけを見る。
    """
    text = _read(os.path.join(DATA, filename))
    start = text.index(assign_prefix)
    # 同じファイルに別の定義（RPG.data.rarities など）が続くことがあるので、
    # 行頭の `};` で必ず打ち切る。
    body = text[start:]
    end = re.search(r"^\};", body, re.MULTILINE)
    if end:
        body = body[:end.start()]

    entries = []
    current = None
    for line in body.splitlines():
        m = re.match(r"^  ([A-Za-z_][A-Za-z0-9_]*):\s*\{", line)
        if m:
            current = m.group(1)
            entries.append([current, current])
            continue
        if current and entries:
            m = re.search(r"name:\s*'([^']*)'", line)
            if m and entries[-1][1] == entries[-1][0]:
                entries[-1][1] = m.group(1)
    return [(i, n) for i, n in entries]


def _parse_art_config():
    """data/art.js から保存先と拡張子を読む。"""
    text = _read(os.path.join(DATA, "art.js"))

    def s(key, default):
        m = re.search(key + r":\s*'([^']*)'", text)
        return m.group(1) if m else default

    exts = re.search(r"extensions:\s*\[([^\]]*)\]", text)
    extensions = re.findall(r"'([^']*)'", exts.group(1)) if exts else [".png"]

    size = re.search(r"standeeSize:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)", text)
    return {
        "character_dir": s("dir", "assets/characters/"),
        "enemy_dir": s("enemyDir", "assets/enemies/"),
        "extensions": extensions,
        "width": int(size.group(1)) if size else 832,
        "height": int(size.group(2)) if size else 1216,
    }


def load_targets():
    """(id, 表示名, 種別ラベル, 保存先ディレクトリ, 既存ファイルのパス or None) の一覧。"""
    cfg = _parse_art_config()
    groups = [
        ("キャラクター", _parse_catalog("characters.js", "RPG.data.characters"), cfg["character_dir"]),
        ("エネミー", _parse_catalog("enemies.js", "RPG.data.enemies"), cfg["enemy_dir"]),
    ]

    targets = []
    for label, entries, rel_dir in groups:
        for cid, name in entries:
            existing = None
            for ext in cfg["extensions"]:
                path = os.path.join(ROOT, rel_dir.replace("/", os.sep), cid + ext)
                if os.path.exists(path):
                    existing = path
                    break
            targets.append({
                "id": cid, "name": name, "kind": label,
                "dir": rel_dir, "existing": existing,
            })
    return targets, cfg


# ---------------------------------------------------------------- 取り込み

def output_name(target, source_path, cfg):
    """読み込み側が探す拡張子ならそのまま使い、未対応なら .png として置く。"""
    ext = os.path.splitext(source_path)[1].lower()
    if ext not in cfg["extensions"]:
        ext = cfg["extensions"][0]
    return target["id"] + ext


def install(target, source_path, cfg, dry_run=False):
    """1件をコピーする。既に別の拡張子で入っていたものは取り除く。"""
    dest_dir = os.path.join(ROOT, target["dir"].replace("/", os.sep))
    dest = os.path.join(dest_dir, output_name(target, source_path, cfg))
    if dry_run:
        return dest

    os.makedirs(dest_dir, exist_ok=True)
    # 同じIDで拡張子違いが残ると、探索順しだいで古い方が読まれてしまう
    for ext in cfg["extensions"]:
        old = os.path.join(dest_dir, target["id"] + ext)
        if os.path.exists(old) and os.path.abspath(old) != os.path.abspath(dest):
            os.remove(old)

    shutil.copyfile(source_path, dest)
    return dest


def guess_target(filename, targets):
    """ファイル名から取り込み先を推測する。ID完全一致 → ID部分一致 → 名前部分一致。"""
    base = os.path.splitext(os.path.basename(filename))[0]
    lower = base.lower()

    for t in targets:
        if t["id"].lower() == lower:
            return t

    by_id = [t for t in targets if t["id"].lower() in lower]
    if by_id:
        return max(by_id, key=lambda t: len(t["id"]))

    by_name = [t for t in targets if t["name"] and t["name"] in base]
    if by_name:
        return max(by_name, key=lambda t: len(t["name"]))
    return None


def check_size(path, cfg):
    """サイズを確かめる。Pillow が無ければ確認を飛ばす。"""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        with Image.open(path) as im:
            if im.size != (cfg["width"], cfg["height"]):
                return "%d×%d（推奨 %d×%d）" % (im.size[0], im.size[1], cfg["width"], cfg["height"])
    except Exception:
        return None
    return None


# ---------------------------------------------------------------- コマンド

def cmd_list(targets):
    for kind in dict.fromkeys(t["kind"] for t in targets):
        group = [t for t in targets if t["kind"] == kind]
        missing = [t for t in group if not t["existing"]]
        print("\n== %s （%d / %d 設定済み）" % (kind, len(group) - len(missing), len(group)))
        for t in missing:
            print("  未設定  %-16s %s" % (t["id"], t["name"]))
    return 0


def cmd_folder(folder, targets, cfg, dry_run):
    if not os.path.isdir(folder):
        print("フォルダが見つかりません:", folder)
        return 1

    exts = tuple(cfg["extensions"]) + (".jpeg",)
    files = [os.path.join(folder, f) for f in sorted(os.listdir(folder))
             if f.lower().endswith(exts)]
    if not files:
        print("画像が見つかりませんでした:", folder)
        return 1

    matched, skipped = 0, []
    for path in files:
        target = guess_target(path, targets)
        if not target:
            skipped.append(os.path.basename(path))
            continue
        dest = install(target, path, cfg, dry_run)
        warn = check_size(path, cfg)
        print("  %s%-16s <- %s%s" % (
            "[確認のみ] " if dry_run else "",
            target["id"], os.path.basename(path),
            ("  ※サイズ " + warn) if warn else ""))
        matched += 1

    print("\n%d 個を取り込みました。" % matched if not dry_run
          else "\n%d 個が対象です（--dry-run のためコピーしていません）。" % matched)
    if skipped:
        print("割り当て先が分からなかったファイル（%d 個）:" % len(skipped))
        for name in skipped:
            print("  " + name)
        print("ファイル名にIDか名前を入れるか、引数なしで実行して1体ずつ選んでください。")
    return 0


def cmd_gui(targets, cfg):
    """エクスプローラーのダイアログで1体ずつ選ぶ。"""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox
    except ImportError:
        print("tkinter が使えません。フォルダを指定する使い方をお試しください:")
        print("  python tools/import_images.py <フォルダ>")
        return 1

    root = tk.Tk()
    root.title("立ち絵の取り込み — ハクスラRPG")
    root.geometry("620x560")

    state = {"targets": targets}

    frame = tk.Frame(root)
    frame.pack(fill="both", expand=True, padx=10, pady=10)

    info = tk.Label(frame, justify="left", anchor="w",
                    text="取り込みたい行を選んで「画像を選ぶ」を押してください。\n"
                         "推奨サイズ %d×%d。一覧は data/ から自動で作られます。"
                         % (cfg["width"], cfg["height"]))
    info.pack(fill="x", pady=(0, 8))

    only_missing = tk.BooleanVar(value=True)
    listbox = tk.Listbox(frame, font=("Consolas", 10))
    scrollbar = tk.Scrollbar(frame, command=listbox.yview)
    listbox.config(yscrollcommand=scrollbar.set)

    def refresh():
        state["targets"], _ = load_targets()
        listbox.delete(0, tk.END)
        state["rows"] = []
        for t in state["targets"]:
            if only_missing.get() and t["existing"]:
                continue
            state["rows"].append(t)
            listbox.insert(tk.END, "%s  %-16s %-14s %s" % (
                "○" if t["existing"] else "×", t["id"], t["kind"], t["name"]))
        done = sum(1 for t in state["targets"] if t["existing"])
        info.config(text="取り込みたい行を選んで「画像を選ぶ」を押してください。\n"
                         "設定済み %d / %d ・推奨サイズ %d×%d"
                         % (done, len(state["targets"]), cfg["width"], cfg["height"]))

    def choose():
        sel = listbox.curselection()
        if not sel:
            messagebox.showinfo("取り込み", "先に一覧から1行選んでください。")
            return
        target = state["rows"][sel[0]]
        path = filedialog.askopenfilename(
            title="%s（%s）の画像を選ぶ" % (target["name"], target["id"]),
            filetypes=[("画像", "*.png *.webp *.jpg *.jpeg"), ("すべて", "*.*")])
        if not path:
            return
        warn = check_size(path, cfg)
        if warn and not messagebox.askyesno(
                "サイズが違います", "サイズ %s\nこのまま取り込みますか？" % warn):
            return
        dest = install(target, path, cfg)
        refresh()
        messagebox.showinfo("取り込み", "%s へコピーしました。" % os.path.relpath(dest, ROOT))

    def choose_folder():
        folder = filedialog.askdirectory(title="画像の入ったフォルダを選ぶ")
        if not folder:
            return
        exts = tuple(cfg["extensions"]) + (".jpeg",)
        files = [os.path.join(folder, f) for f in sorted(os.listdir(folder))
                 if f.lower().endswith(exts)]
        done, skipped = 0, []
        for path in files:
            t = guess_target(path, state["targets"])
            if not t:
                skipped.append(os.path.basename(path))
                continue
            install(t, path, cfg)
            done += 1
        refresh()
        msg = "%d 個を取り込みました。" % done
        if skipped:
            msg += "\n\n割り当て先が分からなかったファイル:\n" + "\n".join(skipped[:10])
            if len(skipped) > 10:
                msg += "\n… ほか %d 個" % (len(skipped) - 10)
        messagebox.showinfo("まとめて取り込み", msg)

    listbox.pack(side="left", fill="both", expand=True)
    scrollbar.pack(side="right", fill="y")

    buttons = tk.Frame(root)
    buttons.pack(fill="x", padx=10, pady=(0, 10))
    tk.Button(buttons, text="画像を選ぶ", command=choose, width=14).pack(side="left")
    tk.Button(buttons, text="フォルダからまとめて", command=choose_folder, width=18).pack(side="left", padx=6)
    tk.Checkbutton(buttons, text="未設定のみ表示", variable=only_missing,
                   command=refresh).pack(side="left", padx=6)
    tk.Button(buttons, text="閉じる", command=root.destroy, width=8).pack(side="right")

    listbox.bind("<Double-Button-1>", lambda e: choose())
    refresh()
    root.mainloop()
    return 0


def main():
    parser = argparse.ArgumentParser(description="立ち絵の取り込みミニツール")
    parser.add_argument("folder", nargs="?", help="画像の入ったフォルダ（省略すると画面で選ぶ）")
    parser.add_argument("--list", action="store_true", help="未設定のものを一覧表示する")
    parser.add_argument("--dry-run", action="store_true", help="コピーせず結果だけ表示する")
    args = parser.parse_args()

    targets, cfg = load_targets()
    print("取り込み先 %d 件（キャラ %d / 敵 %d）を data/ から読み込みました。" % (
        len(targets),
        sum(1 for t in targets if t["kind"] == "キャラクター"),
        sum(1 for t in targets if t["kind"] == "エネミー")))

    if args.list:
        return cmd_list(targets)
    if args.folder:
        return cmd_folder(args.folder, targets, cfg, args.dry_run)
    return cmd_gui(targets, cfg)


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
