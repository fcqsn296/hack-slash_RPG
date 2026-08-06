// キャラクターアートの配置規約 (§1.3 / §9.2)
//
// 立ち絵を assets/characters/ に「キャラクターID.png」の名前で置くだけで、
// データを編集しなくても自動的に読み込まれる。
// 顔アイコンは立ち絵から自動で切り抜かれるため、別途用意する必要はない。
RPG.data.artConfig = {
  /**
   * dir / iconDir の前に付ける基準パス。
   * index.html からは空のままでよい。test/ 以下のページなど、階層の違う場所から
   * 読み込むときだけ '../' などを設定する。
   */
  basePath: '',

  /** 立ち絵を探すフォルダ（basePath からの相対パス） */
  dir: 'assets/characters/',

  /** 探索する拡張子。先に見つかったものを使う */
  extensions: ['.png', '.webp', '.jpg'],

  /** 顔アイコンを明示的に用意する場合のフォルダ。無ければ立ち絵から切り抜く */
  iconDir: 'assets/characters/icons/',

  /**
   * UIアイコンのフォルダ。freegameui.net の CC0 素材（単色SVG）を置いてある。
   * 着色は CSS の mask-image 側で行うので、素材ファイルは無改変のまま。
   */
  uiDir: 'assets/ui/',

  /**
   * 敵の立ち絵を探すフォルダ。
   * 味方と違い、敵は顔の切り抜きを行わず画像をそのまま表示する。
   * 生成した画像を加工せずに置くだけでよい。
   */
  enemyDir: 'assets/enemies/',

  /**
   * ファイル名からの自動読み込みを行うか。
   * false にすると data/characters.js の art.standeeImage に書いたパスだけを使う。
   */
  autoDiscover: true,

  /** 想定している立ち絵のサイズ。表示枠の縦横比に使う */
  standeeSize: { width: 832, height: 1216 },

  /**
   * 顔の自動検出が使えないときに使う既定の切り抜き範囲。
   * 全身の立ち絵で頭部がだいたい収まる位置。値は画像サイズに対する割合。
   *   x, size … 画像の「幅」に対する割合   y … 画像の「高さ」に対する割合
   */
  defaultFace: { x: 0.5, y: 0.125, size: 0.34 },

  /**
   * 立ち絵のピクセルを解析して顔の位置を自動検出するか。
   * file:// で直接開いた場合はブラウザの制限で解析できないため、
   * 自動的に defaultFace へフォールバックする。
   */
  autoDetectFace: true,

  /** 検出結果をブラウザに保存して次回以降の再解析を省く */
  cacheDetection: true,
};
