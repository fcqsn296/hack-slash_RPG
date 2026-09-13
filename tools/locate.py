# -*- coding: utf-8 -*-
"""
imagekit の在り処を探して import できる状態にする。**この1枚だけを写して使う。**

使い方（呼ぶ側のリポジトリの `tools/` に置く）:

    import locate
    locate.ensure()
    from imagekit import pngmeta, webp

探す順番は以下。最初に見つかったものを使う。

    1. 環境変数 IMAGEKIT_HOME
    2. 兄弟ディレクトリ（このファイルから上へ辿って `imagekit/imagekit/` を探す）
    3. すでに import できる状態（pip install -e など）

**見つからなければ黙って続けず、直し方を書いて落ちる。**
「無いときは機能を落として動く」作りにすると、
メタデータ除去のような**通っていないと困る工程**が素通りする。
実際に 218枚の PNG に生成プロンプトが埋まったまま公開しかけた事例があるので、
この工程は「走らなかった」ではなく「止まった」でなければならない。
"""
from __future__ import print_function, unicode_literals

import os
import sys

#: 上へ何階層まで兄弟を探すか。リポジトリが作業ディレクトリの直下にある想定で、
#: 深すぎる探索は関係ないフォルダを拾うので浅く止める。
MAX_UP = 4


def _candidates(start):
    seen = []
    env = (os.environ.get('IMAGEKIT_HOME', '') or '').strip()
    if env:
        seen.append(env)
    d = os.path.abspath(start)
    for _ in range(MAX_UP):
        seen.append(os.path.join(d, 'imagekit'))
        nd = os.path.dirname(d)
        if nd == d:
            break
        d = nd
    return seen


def find(start=None):
    """パッケージを含むディレクトリを返す。見つからなければ None。

    返すのは `imagekit/` パッケージの**親**（sys.path に足す側）。
    """
    start = start or os.path.dirname(os.path.abspath(__file__))
    for c in _candidates(start):
        # c が親（c/imagekit/__init__.py）でも、パッケージ自身
        # （c/__init__.py）でも受ける。渡し間違いで落ちるのが無駄なため。
        if os.path.isfile(os.path.join(c, 'imagekit', '__init__.py')):
            return c
        if os.path.isfile(os.path.join(c, '__init__.py')):
            return os.path.dirname(c)
    return None


def hint(start=None):
    """見つからなかったときに、何をすればよいかまで含めた文。"""
    start = start or os.path.dirname(os.path.abspath(__file__))
    lines = [
        'imagekit が見つかりません。画像の加工処理はこのパッケージにあります。',
        '',
        '探した場所:',
    ]
    for c in _candidates(start):
        lines.append('  - ' + c)
    lines += [
        '',
        '次のどれかで解決します。',
        '  1. imagekit をこのリポジトリの兄弟として置く',
        '       <作業ディレクトリ>/imagekit/imagekit/__init__.py',
        '  2. 置き場所を環境変数で教える',
        '       IMAGEKIT_HOME=<imagekit の親ディレクトリ>',
        '  3. 開発用に入れる',
        '       pip install -e <imagekit のパス>',
        '',
        '**写して持ってこないでください。** 同じ処理が2か所にあると必ずずれます。',
    ]
    return '\n'.join(lines)


def ensure(start=None):
    """import できる状態にする。できなければ RuntimeError。

    返り値は使った場所（すでに import できていたなら None）。
    """
    try:
        import imagekit                      # noqa: F401
        return None
    except ImportError:
        pass
    root = find(start)
    if root is None:
        raise RuntimeError(hint(start))
    if root not in sys.path:
        sys.path.insert(0, root)
    try:
        import imagekit                      # noqa: F401
    except ImportError as e:
        raise RuntimeError(hint(start) + '\n\n（%s を見つけましたが読み込めません: %s）'
                           % (root, e))
    return root


if __name__ == '__main__':
    try:
        where = ensure()
        import imagekit
        print('imagekit %s' % imagekit.__version__)
        print('場所: %s' % os.path.dirname(os.path.abspath(imagekit.__file__)))
        if where:
            print('（%s を sys.path に足しました）' % where)
    except RuntimeError as e:
        print(e)
        sys.exit(1)
