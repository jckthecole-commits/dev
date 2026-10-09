"""
Builds the self-hosted web fonts in src/fonts from the upstream variable fonts (SIL OFL 1.1).

    pip install fonttools brotli
    python3 scripts/build-fonts.py <dir with the source .ttf files> [out dir, default src/fonts]

Sources (github.com/google/fonts, ofl/):
    monasans/MonaSans[wdth,wght].ttf
    atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext[wght].ttf
    atkinsonhyperlegiblemono/AtkinsonHyperlegibleMono[wght].ttf
    bodonimoda/BodoniModa-Italic[opsz,wght].ttf

Each font is pinned to the instance the site uses, subset to Latin + Romanian and
stripped of hinting: ~60 KB for the whole first paint instead of ~300 KB. Mona Sans
carries a Reserved Font Name, so the modified build is renamed ("SV Display").
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FULL = ['U+0020-007E', 'U+00A0-00FF', 'U+0102-0103', 'U+0218-021B', 'U+015E-015F', 'U+0162-0163', 'U+0131',
        'U+2010-2014', 'U+2018-201E', 'U+2022', 'U+2026', 'U+2032-2033', 'U+2039-203A', 'U+20AC', 'U+2122',
        'U+2190-2199', 'U+2212', 'U+2248', 'U+2264-2265', 'U+25A1']
# display text: headings, names, numbers — Romanian letters and a little punctuation
DISPLAY = ['U+0020-007E', 'U+00A0', 'U+00B7', 'U+00D7', 'U+00C2', 'U+00CE', 'U+00E2', 'U+00EE', 'U+00E9', 'U+0102-0103',
           'U+0218-021B', 'U+015E-015F', 'U+0162-0163', 'U+2013-2014', 'U+2018-2019', 'U+201C-201E', 'U+2026',
           'U+2190-2193', 'U+2212', 'U+25A1', 'U+00AB', 'U+00BB']
FEATURES = 'kern,liga,calt,ccmp,locl,mark,mkmk,tnum,lnum,case,pnum'


def build(src, out, axes, unicodes, rename=None):
    font = TTFont(src, lazy=False)
    if axes:
        font = instancer.instantiateVariableFont(font, axes, updateFontNames=False)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = FEATURES.split(',')
    opts.hinting = False
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(','.join(unicodes)))
    sub.subset(font)
    if rename:
        old, new = rename
        for rec in font['name'].names:
            if rec.nameID in (1, 3, 4, 6, 16, 18, 21):
                rec.string = rec.toUnicode().replace(old, new).replace(old.replace(' ', ''), new.replace(' ', ''))
    font.flavor = 'woff2'
    font.save(out)
    print(f'{os.path.basename(out)}: {os.path.getsize(out)} bytes')


if __name__ == '__main__':
    src_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'src', 'fonts')
    s = lambda name: os.path.join(src_dir, name)
    o = lambda name: os.path.join(out_dir, name)
    mona = ('Mona Sans', 'SV Display')
    build(s('MonaSans[wdth,wght].ttf'), o('display.woff2'), {'wght': 740, 'wdth': 112}, DISPLAY, mona)
    build(s('MonaSans[wdth,wght].ttf'), o('display-wdth.woff2'), {'wght': 740, 'wdth': (90, 125)}, DISPLAY, mona)
    build(s('AtkinsonHyperlegibleNext[wght].ttf'), o('text-400.woff2'), {'wght': 400}, FULL)
    build(s('AtkinsonHyperlegibleNext[wght].ttf'), o('text-700.woff2'), {'wght': 700}, FULL)
    build(s('AtkinsonHyperlegibleMono[wght].ttf'), o('mono-400.woff2'), {'wght': 400}, FULL)
    build(s('BodoniModa-Italic[opsz,wght].ttf'), o('serif-italic.woff2'), {'wght': 540, 'opsz': 72}, DISPLAY)
