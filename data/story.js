// @ts-check
/**
 * 物語 (§20.2)。
 *
 * ── 章とシーンの関係 ──
 * 章は「シーンの並び」でしかない。シーンは **条件が満たされたときに再生される**。
 * 順番に消化していく形にせず条件で引くのは、探索の順序を縛らないため。
 * 宝箱を先に開けても、寄り道してから戻っても、話は同じところで挟まる。
 *
 * ── なぜ「フラグを見る」だけなのか ──
 * マップ側のイベント (§20) が既にフラグを立てている。
 * 話の進行を別の仕組みで数え直すと、二重帳簿になって必ずずれる。
 * シーンの条件はマップが立てたフラグをそのまま読む。
 *
 * when の書き方:
 *   null            … 章に入った時点で再生する（＝章の導入）
 *   { flag: 'x' }   … そのフラグが立ったら再生する
 *   { flags: [..] } … 全部立ったら再生する
 *
 * then の書き方（どれも省略可）:
 *   enterMap : 再生後にそのマップへ入る（章の導入で使う）
 *   flag     : 再生後に立てるフラグ。次のシーンの条件にできる
 *   clear    : true なら、この章をクリア扱いにして次の章へ進む
 *
 * lines の who は data/characters.js のID。null なら地の文。
 */
(function (RPG) {
  'use strict';

  RPG.data.story = {
    chapters: [
      {
        id: 'ch1',
        name: '第一章　灰の目覚め',
        lead: '旧文明の炉で目を覚ます。名前も、来歴も残っていない。',
        scenes: [
          {
            id: 'ch1_wake',
            when: null,
            lines: [
              { who: null, text: '——起動。生体維持プロトコル、解除。' },
              { who: null, text: '瞼の裏で銀色の何かが流れた。冷たい。それが自分の血だと、なぜか分かる。' },
              { who: 'ch_hero', text: '……ここは。' },
              { who: null, text: '名前が出てこない。生まれた場所も、ここへ来た理由も。' },
              { who: null, text: '残っているのは、武器の握り方と、術式の解き方だけだった。' },
            ],
            then: { enterMap: 'mp_forge' },
          },
          {
            id: 'ch1_rizel',
            when: { flag: 'join_rizel' },
            lines: [
              { who: 'ch_rizel', text: 'あなた、自分の名前も言えないのね。' },
              { who: 'ch_hero', text: '……あなたは。どこから来た。' },
              { who: 'ch_rizel', text: 'リゼル。灰の野の向こうの集落で生まれて、遺構を漁って食べてる。' },
              { who: 'ch_rizel', text: 'ここは半年前から目を付けてた。扉が固くて開かなかったけど——三日前に、勝手に開いた。' },
              { who: 'ch_rizel', text: '中で人が眠ってるとは思わなかった。しかも起きるとは。' },
              { who: 'ch_hero', text: '……名乗り返せない。' },
              { who: 'ch_rizel', text: 'いいわ。呼び方はこっちで決める。……灰銀の継承者。そう呼ばれてた人がいたって、話だけは聞いたことがある。' },
              { who: 'ch_rizel', text: '眠ってた炉から出てきて、体の中を銀が流れてる。他に当てはまる呼び名がない。' },
              { who: 'ch_rizel', text: '——外へ出るなら、東の階段。灰の野を抜けないとどこへも行けない。' },
            ],
          },
          {
            id: 'ch1_ashfield',
            when: { flag: 'saw_mp_ashfield' },
            lines: [
              { who: null, text: '扉の向こうは、見渡すかぎり灰だった。降っているのか、舞い上がっているのかも分からない。' },
              { who: 'ch_rizel', text: 'これが今の世界。……あなたが眠ってるあいだに、こうなった。' },
              { who: 'ch_hero', text: '眠っているあいだに。' },
              { who: 'ch_rizel', text: 'どれくらいかは誰も知らない。炉の記録は全部灰になってたから。' },
              { who: 'ch_rizel', text: '気をつけて。草の陰にいるのは、もう狼とは呼べない何かよ。' },
              { who: 'ch_rizel', text: 'エーテルを浴びた獣は、形も気性も変わる。灰を吸って肥った蝙蝠なんかもいる。' },
              { who: 'ch_hero', text: '機械の類はいないのか。' },
              { who: 'ch_rizel', text: '旧いのは炉の中で止まってる。外にいるのは、ぜんぶ生き物。' },
            ],
          },
          {
            id: 'ch1_hamlet',
            when: { flag: 'saw_mp_hamlet' },
            lines: [
              { who: null, text: '灰が薄くなり、地面の色が戻ってきた。低い屋根がいくつも並んでいる。' },
              { who: 'ch_rizel', text: '灰縁の集落。私が生まれたところ。' },
              { who: 'ch_hero', text: '人が住んでいるのか。' },
              { who: 'ch_rizel', text: '住んでるっていうより、まだ出ていってないだけ。畑はもう三年だめ。' },
              { who: 'ch_rizel', text: '……あなたのことを訊くなら長老。広場の北にいる。' },
              { who: 'ch_rizel', text: '言っておくけど、期待しないで。ここの人たちが知ってることなんて、たかが知れてる。' },
            ],
          },
          {
            id: 'ch1_elder',
            when: { flag: 'hamlet_elder' },
            lines: [
              { who: null, text: '長老は主人公の腕を一度だけ見て、すぐに目を逸らした。' },
              { who: null, text: '長老「昔、空が焼けた。それだけは全員が同じことを言う。」' },
              { who: null, text: '長老「そのあと灰が降りはじめて、獣の形が変わった。人も変わった——術を使う子が生まれるようになった。」' },
              { who: 'ch_hero', text: '……何年前だ。' },
              { who: null, text: '長老「知らん。三代前の話だという者もいれば、三十代前だという者もいる。書いたものが残っておらん。」' },
              { who: null, text: '長老「わしらは字を読める者が二人しかおらん。読めても、読むものが無い。」' },
              { who: 'ch_rizel', text: '……ほらね。' },
              { who: null, text: '長老「ただし、これだけは言える。灰の野の炉は昔から開かなかった。開いた話は聞いたことがない。」' },
              { who: null, text: '長老「そこから人が出てきたなら——」' },
              { who: null, text: '外で悲鳴が上がった。' },
            ],
            then: { flag: 'hamlet_raid' },
          },
          {
            id: 'ch1_raid',
            when: { flag: 'hamlet_raid' },
            lines: [
              { who: null, text: '広場の井戸が砕けていた。土を割って出てきたものが、そこに立っている。' },
              { who: 'ch_rizel', text: '喰王ガルグ……！ こんな内側まで来るなんて聞いてない。' },
              { who: 'ch_hero', text: '知っているのか。' },
              { who: 'ch_rizel', text: '灰の野の主。人の匂いのする側には近づかないはずだった。' },
              { who: 'ch_rizel', text: '——今日から違うのかもしれない。あなたが起きた日から。' },
              { who: null, text: '広場へ出れば、戦うことになる。' },
            ],
          },
          {
            id: 'ch1_boss',
            when: { flag: 'gnaw_slain' },
            lines: [
              { who: null, text: '巨体が崩れ、灰が舞い上がって、それきり動かなくなった。' },
              { who: 'ch_rizel', text: '……倒せるんだ、あれ。' },
              { who: 'ch_hero', text: '身体が覚えていた。誰に習ったのかは分からない。' },
              { who: 'ch_rizel', text: '長老の言いかけたこと、聞いた？ 「そこから人が出てきたなら」——その先。' },
              { who: 'ch_hero', text: '聞いていない。だが見当はつく。' },
              { who: 'ch_hero', text: 'この土地の記録は全部灰になっている。長老も、あなたも、何も知らない。' },
              { who: 'ch_hero', text: 'なら、残っている場所は一つしかない。' },
              { who: 'ch_rizel', text: '……炉。あなたが寝てたところ。' },
              { who: 'ch_hero', text: '扉が開いたのは、俺が起きたからだ。中にまだ何かあるなら、今なら開く。' },
              { who: 'ch_rizel', text: '戻りましょう。今度は奥まで。' },
            ],
            then: { flag: 'plan_forge' },
          },
          {
            id: 'ch1_end',
            when: { flag: 'back_at_forge' },
            lines: [
              { who: null, text: '炉の中心。目を覚ましたときには気づかなかったが、床に円い継ぎ目がある。' },
              { who: 'ch_rizel', text: '……こんなの、さっきまで無かった。' },
              { who: 'ch_hero', text: 'あった。閉じていただけだ。' },
              { who: null, text: '主人公が手を触れると、腕の下で銀が音もなく流れ、継ぎ目に沿って光が走った。' },
              { who: null, text: '床が沈み、下へ続く道が現れる。灰の匂いはしない。ここだけ、崩壊が届いていない。' },
              { who: 'ch_rizel', text: '下に何があるの。' },
              { who: 'ch_hero', text: '分からない。……いや。' },
              { who: 'ch_hero', text: '人がいる。眠っている。俺と同じように。' },
              { who: null, text: '——第一章 了' },
            ],
            then: { clear: true },
          },
        ],
      },

      {
        id: 'ch2',
        name: '第二章　継承の座',
        lead: '炉の下には、灰の届かない場所がある。',
        scenes: [
          {
            id: 'ch2_descend',
            when: { flag: 'saw_mp_vault' },
            lines: [
              { who: null, text: '階を下りきると、空気が変わった。乾いていて、冷たくて、灰の匂いがまったくしない。' },
              { who: 'ch_rizel', text: '……嘘。ここ、外と繋がってない。' },
              { who: 'ch_rizel', text: '遺構はどこも灰まみれよ。隙間から入るの。ここは、一度も入られてない。' },
              { who: 'ch_hero', text: '閉じていたからだ。俺が起きるまで。' },
              { who: null, text: '壁の一部がまだ淡く光っている。止まってはいるが、死んではいない。' },
              { who: 'ch_rizel', text: '……動いてる旧いのって、こういうのを言うのね。' },
            ],
          },
          {
            id: 'ch2_pods',
            when: { flag: 'vault_pods' },
            lines: [
              { who: null, text: '壁沿いに、人ひとりぶんの箱が並んでいる。数えるのをやめるくらいには並んでいる。' },
              { who: 'ch_rizel', text: '……全部、人が入ってるの？' },
              { who: 'ch_hero', text: '入っていた、が正しい。表示が落ちているものは、もう戻らない。' },
              { who: 'ch_rizel', text: 'どうしてそんなことが分かるの。' },
              { who: 'ch_hero', text: '分からない。読めるだけだ。……ここに来ると、手が勝手に動く。' },
              { who: null, text: '主人公が触れた覚えのない操作面に、腕の銀が流れ込んでいく。' },
              { who: null, text: '一つだけ、まだ光の残っている箱があった。' },
            ],
          },
          {
            id: 'ch2_shiki',
            when: { flag: 'join_shiki' },
            lines: [
              { who: null, text: '霜が割れ、蓋が引いた。中の人物は、目を開ける前に体を起こしていた。' },
              { who: 'ch_shiki', text: '……ここ、まだ持ってたんだ。' },
              { who: 'ch_rizel', text: 'しゃ、喋った。起きてすぐ。' },
              { who: 'ch_shiki', text: 'そういう風に納められてるから。寝惚ける時間は勘定に入ってない。' },
              { who: 'ch_shiki', text: '……で。管理者。あんた、何年ぶり？' },
              { who: 'ch_hero', text: '分からない。名前も覚えていない。' },
              { who: 'ch_shiki', text: 'ふうん。焼けたんだ、そっちも。' },
              { who: 'ch_shiki', text: 'いいよ。順番が逆になっただけ。起こされた側が覚えてるなんて、笑い話だけど。' },
              { who: 'ch_rizel', text: '……あなた、何を覚えてるの。' },
              { who: 'ch_shiki', text: '空が焼けた日のこと。それと、ここに何人納めたか。' },
              { who: 'ch_shiki', text: 'シキ。連れていってよ。ここで待ってても、もう誰も来ない。' },
            ],
            then: { clear: true },
          },
        ],
      },

      {
        id: 'ch3',
        name: '第三章　二番機',
        lead: '納めた者の名を、まだ唱えているものがいる。',
        scenes: [
          {
            id: 'ch3_open',
            when: null,
            lines: [
              { who: 'ch_shiki', text: 'ひとつ言っておく。ここ、まだ下がある。' },
              { who: 'ch_rizel', text: '……下？ ここが一番下じゃないの。' },
              { who: 'ch_shiki', text: '納められる側は運ばれるから、通った道を覚えてる。' },
              { who: 'ch_shiki', text: '私は東の階から下ろされた。あの壁、板が張ってあるだけ。' },
              { who: 'ch_hero', text: '……下に何がある。' },
              { who: 'ch_shiki', text: 'そっちの持ち場でしょ、管理者。' },
              { who: 'ch_shiki', text: '——覚えてないのは分かってる。だから見に行こうって言ってる。' },
            ],
          },
          {
            id: 'ch3_descend',
            when: { flag: 'saw_mp_deep' },
            lines: [
              { who: null, text: '階を下りると、明かりがついた。誰も操作していないのに、順に、奥へ向かって。' },
              { who: 'ch_rizel', text: '……こっち来るなって言われてる気がしてきた。' },
              { who: 'ch_shiki', text: '逆。案内されてる。' },
              { who: null, text: '通路の先に、動くものがあった。人の背丈ほどの機体が、灯りを掲げて立っている。' },
              { who: 'ch_rizel', text: 'あれ、こっち見てる？' },
              { who: 'ch_shiki', text: '見てるっていうか、照らしてる。仕事してるだけ。' },
              { who: 'ch_shiki', text: '……止め方を知ってる人がもういないだけ。' },
            ],
          },
          {
            id: 'ch3_index',
            when: { flag: 'deep_index' },
            lines: [
              { who: null, text: '紙の燃え残りが、床から膝の高さで渦を巻いていた。その中心に、輪郭だけの人影がある。' },
              { who: null, text: '影「——第三区、四十一。収容。第三区、四十二。収容。」' },
              { who: 'ch_rizel', text: '数えてる……？' },
              { who: 'ch_shiki', text: '数えてるんじゃない。読んでる。ここに納めた人の索引よ。' },
              { who: 'ch_shiki', text: '……私も、そのどこかに載ってる。' },
              { who: null, text: '影「第九区、七。収容。第九区、八。収——」' },
              { who: null, text: '影の声が、そこで止まった。' },
              { who: null, text: '影「……読めません。項目が焼けています。」' },
              { who: null, text: '影「担当者、確認を。担当者。担当者。」' },
              { who: null, text: '影が、主人公のほうを向いた。' },
              { who: null, text: '影「——ああ。いらしたのですね。」' },
              { who: 'ch_hero', text: '……俺が、誰か分かるのか。' },
              { who: null, text: '影「分かりません。分かりませんが、あなたの署名だけは全部の頁に入っています。」' },
              { who: null, text: '影「納めたのは、あなたです。ひとり残らず。」' },
              { who: 'ch_rizel', text: '……え。' },
              { who: 'ch_hero', text: '……全員を、俺が。' },
              { who: null, text: '影「はい。最後の一名を除いて。」' },
              { who: 'ch_shiki', text: '……最後の一名って。' },
              { who: null, text: '影「読めません。項目が焼けています。」' },
              { who: null, text: '影は同じ言葉に戻り、また最初から数えはじめた。' },
            ],
          },
          {
            id: 'ch3_duo',
            when: { flag: 'duo_slain' },
            lines: [
              { who: null, text: '装甲が割れ、内側から古い紙が溢れ出した。焼けていない紙だった。' },
              { who: 'ch_rizel', text: '……紙？ この中、紙が詰まってたの？' },
              { who: 'ch_shiki', text: '写しよ。命令書の。二番機は控えを持たされる。' },
              { who: 'ch_hero', text: '控え。……何の。' },
              { who: null, text: '床に散った一枚を拾う。掠れてはいるが、読めた。' },
              { who: null, text: '『継承の座、封鎖。解除は継承者の手による。』' },
              { who: null, text: '『継承者が現れぬ場合、一番機は待機を継続する。』' },
              { who: 'ch_shiki', text: '……待機を継続する。期限、書いてないわね。' },
              { who: 'ch_rizel', text: 'それ、いつまでって決めてないってこと？' },
              { who: 'ch_hero', text: '決めなかったんだろう。決めなくても、そのうち誰か来ると思っていた。' },
            ],
          },
          {
            id: 'ch3_astra',
            when: { flag: 'join_astra' },
            lines: [
              { who: null, text: '小部屋の中央に、立ったまま停まっている人影があった。機械ではない。だが人でもない。' },
              { who: null, text: '主人公が近づくと、瞼が上がった。埃も落ちなかった。' },
              { who: 'ch_astra', text: '——受領の確認を。' },
              { who: 'ch_hero', text: '……何の。' },
              { who: 'ch_astra', text: '零式。遺構兵装。受領者、継承者。' },
              { who: 'ch_astra', text: '一番機より預かり、待機しておりました。経過時間、計測不能。' },
              { who: 'ch_rizel', text: '……預かってた？ ずっと？' },
              { who: 'ch_astra', text: 'はい。渡す相手が来るまで、と。' },
              { who: 'ch_shiki', text: '来なかったわけね。長いこと。' },
              { who: 'ch_astra', text: 'いいえ。来ました。本日。' },
              { who: null, text: '言い方に、恨みも喜びもなかった。ただ、記録として正しいことを言っていた。' },
              { who: 'ch_hero', text: '……アストラ。そう呼んでいいか。' },
              { who: 'ch_astra', text: '呼称の指定を受領しました。以後そう応じます。' },
            ],
          },
          {
            id: 'ch3_end',
            when: { flags: ['join_astra', 'deep_gate'] },
            lines: [
              { who: null, text: '最奥の階段は、板で塞がれていた。板の向こうから、規則正しい音が届いてくる。' },
              { who: null, text: '歩く音だった。同じ間隔で、同じ重さで、行っては戻っている。' },
              { who: 'ch_astra', text: '一番機です。順路の巡回を継続しています。' },
              { who: 'ch_hero', text: '……お前を渡し終えたなら、待つ理由はもう無いはずだ。' },
              { who: 'ch_astra', text: 'はい。ですので、待機の対象が書き換わっています。' },
              { who: 'ch_rizel', text: '書き換わってるって、勝手に？' },
              { who: 'ch_astra', text: '命令に期限がない場合、機体は命令を保つために解釈を変更します。' },
              { who: 'ch_astra', text: '一番機は「渡す」を保ちました。渡す相手がいないので、' },
              { who: 'ch_astra', text: '——渡せるものを、増やす側へ。' },
              { who: 'ch_shiki', text: '……増やす。何を。' },
              { who: 'ch_astra', text: '収容者を。' },
              { who: null, text: '誰も、しばらく何も言わなかった。' },
              { who: 'ch_rizel', text: '……外の灰。あれ、まさか。' },
              { who: 'ch_hero', text: '——今は開かない。この板は、こちらの手に応えなかった。' },
              { who: 'ch_shiki', text: '応えるようになるまで、こっちが上がるしかないってことね。' },
              { who: 'ch_hero', text: 'ああ。……いずれ戻る。今度は、開けに来る。' },
              { who: null, text: '——第三章 了' },
            ],
            then: { clear: true },
          },
        ],
      },
    ],
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
