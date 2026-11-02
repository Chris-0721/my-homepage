"""两张照片拼成 4:3 相纸风拼贴（与 lcfa2026-1.jpg 同一视觉语言）"""
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1600, 1200
WIN_W, WIN_H = 660, 495
BORDER = 20


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im2 = im.resize((max(1, int(im.width * r + 0.5)), max(1, int(im.height * r + 0.5))), Image.LANCZOS)
    x = (im2.width - w) // 2
    y = (im2.height - h) // 2
    return im2.crop((x, y, x + w, y + h))


def make_paper(src):
    inner = cover(Image.open(src).convert('RGB'), WIN_W, WIN_H)
    pw, ph = WIN_W + BORDER * 2, WIN_H + BORDER * 2
    p = Image.new('RGB', (pw, ph), (252, 251, 249))
    p.paste(inner, (BORDER, BORDER))
    d = ImageDraw.Draw(p)
    d.rectangle([0, 0, pw - 1, ph - 1], outline=(226, 222, 216))
    return p


def background():
    top = np.array([239, 236, 231], dtype=np.float32)
    bot = np.array([219, 214, 206], dtype=np.float32)
    ramp = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    arr = top[None, None, :] + (bot - top)[None, None, :] * ramp
    arr = np.repeat(arr, W, axis=1)
    noise = np.random.default_rng(7).normal(0, 2.6, (H, W, 1)).astype(np.float32)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB')


def place(canvas, paper, cx, cy, angle, shadow_alpha=130, shadow_offset=(10, 14), blur=16):
    rot = paper.rotate(angle, expand=True, resample=Image.BICUBIC)
    mask = Image.new('L', paper.size, 255).rotate(angle, expand=True, resample=Image.BICUBIC)
    sw, sh = rot.size
    shadow = Image.new('L', canvas.size, 0)
    shadow_layer = Image.new('L', (sw, sh), 0)
    shadow_layer.paste(mask, (0, 0))
    shadow_layer = shadow_layer.point(lambda v: shadow_alpha if v > 128 else 0).filter(
        ImageFilter.GaussianBlur(blur)
    )
    shadow.paste(shadow_layer, (int(cx - sw / 2 + shadow_offset[0]), int(cy - sh / 2 + shadow_offset[1])))
    canvas.paste(Image.new('RGB', canvas.size, (60, 54, 46)), (0, 0), shadow)
    canvas.paste(rot, (int(cx - sw / 2), int(cy - sh / 2)), mask)


def build(sources, out, layout):
    canvas = background()
    for item in layout:
        src, cx, cy, ang = item[0], item[1], item[2], item[3]
        scale = item[4] if len(item) > 4 else 1.0
        paper = make_paper(src)
        if scale != 1.0:
            paper = paper.resize(
                (int(paper.width * scale), int(paper.height * scale)), Image.LANCZOS
            )
        place(canvas, paper, cx, cy, ang)
    canvas.save(out, 'JPEG', quality=90, optimize=True, progressive=False)
    print('saved', out, canvas.size)


if __name__ == '__main__':
    base = r'C:\Users\admin\WorkBuddy\20260411131313\my-academic-homepage\public\Conference'
    build(
        [f'{base}\\mahx2026-1.jpg', f'{base}\\mahx2026-2.jpg'],
        f'{base}\\mahx2026-pair.jpg',
        [
            (f'{base}\\mahx2026-1.jpg', 445, 640, -4.2, 1.0),
            (f'{base}\\mahx2026-2.jpg', 1160, 570, 3.4, 0.94),
        ],
    )
    build(
        [f'{base}\\osac2026-1.jpg', f'{base}\\osac2026-2.jpg'],
        f'{base}\\osac2026-pair.jpg',
        [
            (f'{base}\\osac2026-1.jpg', 470, 575, 3.6, 0.94),
            (f'{base}\\osac2026-2.jpg', 1155, 645, -3.8, 1.0),
        ],
    )
