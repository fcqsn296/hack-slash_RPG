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
    ],
  };
})(window.RPG || (window.RPG = { data: {}, plugins: {} }));
