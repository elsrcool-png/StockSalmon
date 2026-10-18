#!/usr/bin/env python3
"""Generate StockSalmon launcher icons without changing app logic."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__import__("sys").argv[1])
NAVY = (12, 29, 52, 255)
ORANGE = (255, 132, 55, 255)
LIGHT = (255, 239, 215, 255)
DARK = (7, 19, 35, 255)

def draw_icon(size, adaptive=False):
    im = Image.new("RGBA", (size, size), NAVY)
    d = ImageDraw.Draw(im)
    # Leave Android adaptive-icon safe margins around the central symbol.
    s = size / 512
    def pts(points):
        return [(int(x*s), int(y*s)) for x,y in points]
    # Subtle inset ring
    d.ellipse((int(28*s),int(28*s),int(484*s),int(484*s)), outline=(33,57,80,255), width=max(2,int(5*s)))
    # Salmon tail
    d.polygon(pts([(112,256),(48,194),(54,256),(48,318)]), fill=ORANGE)
    # Main body
    d.ellipse((int(91*s),int(150*s),int(390*s),int(362*s)), fill=ORANGE)
    # Nose and gentle snout
    d.ellipse((int(340*s),int(193*s),int(430*s),int(319*s)), fill=ORANGE)
    # Belly highlight
    d.polygon(pts([(148,286),(190,324),(282,330),(334,301),(305,337),(220,350),(162,326)]), fill=LIGHT)
    # Gill curve approximated with a thick dark arc
    d.arc((int(270*s),int(199*s),int(346*s),int(307*s)), start=65, end=285, fill=NAVY, width=max(3,int(8*s)))
    # Dorsal fin
    d.polygon(pts([(177,164),(218,112),(263,159),(286,171)]), fill=ORANGE)
    # Lower fin
    d.polygon(pts([(212,333),(249,386),(281,335)]), fill=ORANGE)
    # Tail detail
    d.line(pts([(80,222),(103,256),(80,291)]), fill=LIGHT, width=max(2,int(6*s)), joint="curve")
    # Eye
    r=max(3,int(10*s))
    ex,ey=int(370*s),int(224*s)
    d.ellipse((ex-r,ey-r,ex+r,ey+r), fill=LIGHT)
    rr=max(2,int(4*s))
    d.ellipse((ex-rr,ey-rr,ex+rr,ey+rr), fill=DARK)
    # Small stock/check motif: three short pale inventory lines on lower-left body
    d.line(pts([(142,250),(168,250)]), fill=LIGHT, width=max(2,int(6*s)))
    d.line(pts([(142,267),(160,267)]), fill=LIGHT, width=max(2,int(6*s)))
    return im

def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)

# Legacy launcher icons in density-specific Android resource folders.
for density, px in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
    folder = OUT / f"mipmap-{density}"
    icon = draw_icon(px)
    save(icon, folder / "ic_launcher.png")
    save(icon, folder / "ic_launcher_round.png")

# Adaptive launcher icon for Android 8+.
adaptive_dir = OUT / "drawable"
save(draw_icon(432, adaptive=True), adaptive_dir / "ic_launcher_foreground.png")
values = OUT / "values"
values.mkdir(parents=True, exist_ok=True)
(values / "ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\\n'
    '<resources><color name="ic_launcher_background">#0C1D34</color></resources>\\n',
    encoding="utf-8")
adaptive = OUT / "mipmap-anydpi-v26"
adaptive.mkdir(parents=True, exist_ok=True)
xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
'''
(adaptive / "ic_launcher.xml").write_text(xml, encoding="utf-8")
(adaptive / "ic_launcher_round.xml").write_text(xml, encoding="utf-8")
print(f"StockSalmon icons generated in {OUT}")
