"""两张照片拼成 4:3 相纸拼贴：大纸打底 + 第二张斜压其上，留白少、有遮挡层次"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1600, 1200


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im2 = im.resize((max(1, int(im.width * r + 0.5)), max(1, int(im.height * r + 0.5))), Image.LANCZOS)
    x = (im2.width - w) // 2
    y = (im2.height - h) // 2
    return im2.crop((x, y, x + w, y + h))


def tint(im, warmth):
    """warmth>0 偏暖（黄红），<0 偏冷（蓝）。幅度很小，只为打破两张纸的均质感。"""
    if not warmth:
        return im
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * (1 + 0.030 * warmth))))
    b = b.point(lambda v: int(v * (1 - 0.028 * warmth)))
    return Image.merge('RGB', (r, g, b))


def make_paper(src, win_w, win_h, border, warmth=0.0):
    inner = tint(cover(Image.open(src).convert('RGB'), win_w, win_h), warmth)
    pw, ph = win_w + border * 2, win_h + border * 2
    p = Image.new('RGB', (pw, ph), (252, 251, 249))
    p.paste(inner, (border, border))
    ImageDraw.Draw(p).rectangle([0, 0, pw - 1, ph - 1], outline=(224, 220, 214))
    return p


def background():
    top = np.array([240, 237, 232], dtype=np.float32)
    bot = np.array([214, 209, 200], dtype=np.float32)
    ramp = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    arr = top[None, None, :] + (bot - top)[None, None, :] * ramp
    arr = np.repeat(arr, W, axis=1)
    noise = np.random.default_rng(7).normal(0, 2.8, (H, W, 1)).astype(np.float32)
    return Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8), 'RGB')


def vignette(canvas, strength=0.20, reach=0.60):
    w, h = canvas.size
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt(((x - w / 2) / (w * reach)) ** 2 + ((y - h / 2) / (h * reach)) ** 2)
    v = np.clip(1 - strength * np.clip(d, 0, 1.7) ** 2.2, 0, 1)
    arr = np.asarray(canvas, dtype=np.float32) * v[:, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGB')


def place(canvas, paper, cx, cy, angle, shadow_alpha=155, offset=(16, 20), blur=20):
    rot = paper.rotate(angle, expand=True, resample=Image.BICUBIC)
    mask = Image.new('L', paper.size, 255).rotate(angle, expand=True, resample=Image.BICUBIC)
    sw, sh = rot.size
    shadow = Image.new('L', canvas.size, 0)
    layer = Image.new('L', (sw, sh), 0)
    layer.paste(mask, (0, 0))
    layer = layer.point(lambda v: shadow_alpha if v > 128 else 0).filter(ImageFilter.GaussianBlur(blur))
    shadow.paste(layer, (int(cx - sw / 2 + offset[0]), int(cy - sh / 2 + offset[1])))
    canvas.paste(Image.new('RGB', canvas.size, (58, 52, 44)), (0, 0), shadow)
    canvas.paste(rot, (int(cx - sw / 2), int(cy - sh / 2)), mask)


def build(out, layout):
    canvas = background()
    for item in layout:
        paper = make_paper(item['src'], item['win'][0], item['win'][1], item.get('border', 20),
                           item.get('warmth', 0.0))
        if item.get('scale', 1.0) != 1.0:
            s = item['scale']
            paper = paper.resize((int(paper.width * s), int(paper.height * s)), Image.LANCZOS)
        place(canvas, paper, item['cx'], item['cy'], item['angle'],
              shadow_alpha=item.get('shadow', 155))
    canvas = vignette(canvas)
    canvas.save(out, 'JPEG', quality=90, optimize=True, progressive=False)
    print('saved', out, canvas.size)


BASE = r'C:\Users\admin\WorkBuddy\20260411131313\my-academic-homepage\public\Conference'

JOBS = {
    # 大纸放大到铺满画布（只留一圈窄边），小图放大到 ~40% 并置于上层完整可见
    'mahx2026-pair3.jpg': [
        dict(src=f'{BASE}\\mahx2026-1.jpg', win=(1340, 1005), cx=800, cy=598, angle=-2.0,
             border=24, warmth=0.9),
        dict(src=f'{BASE}\\mahx2026-2.jpg', win=(540, 405), cx=1278, cy=930, angle=4.2,
             border=20, warmth=-0.5, shadow=205),
    ],
    'osac2026-pair3.jpg': [
        dict(src=f'{BASE}\\osac2026-1.jpg', win=(1340, 1005), cx=800, cy=598, angle=1.8,
             border=24, warmth=-0.5),
        dict(src=f'{BASE}\\osac2026-2.jpg', win=(540, 405), cx=1278, cy=930, angle=-3.6,
             border=20, warmth=0.9, shadow=205),
    ],
}

if __name__ == '__main__':
    for name, layout in JOBS.items():
        build(f'{BASE}\\{name}', layout)
