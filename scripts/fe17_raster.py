"""
A small software rasterizer for scripts/fe17_models.py (numba): textured, depth-tested triangles with Engage's two-tone toon
shading, worked in linear light, and inverted-hull outlines. Needs: pip install numba.
"""
import numpy as np
from numba import njit


@njit(cache=True)
def _sample(tex, u, v):
    h, w = tex.shape[0], tex.shape[1]
    u = u - np.floor(u)
    v = v - np.floor(v)
    x = u * w - 0.5
    y = (1.0 - v) * h - 0.5
    x0 = int(np.floor(x))
    y0 = int(np.floor(y))
    fx = x - x0
    fy = y - y0
    out = np.zeros(4)
    for dy in range(2):
        for dx in range(2):
            xx = (x0 + dx) % w
            yy = (y0 + dy) % h
            wt = (fx if dx else 1.0 - fx) * (fy if dy else 1.0 - fy)
            for c in range(4):
                out[c] += tex[yy, xx, c] * wt
    return out


@njit(cache=True)
def draw(color, depth, sx, sy, sz, sw, uv, nrm, vcol, tris, tex, light, shade, cutoff, mode, cull, lit_always, add, fill, fill_col):
    """Draws triangles into color (H,W,4) and depth (H,W).
    sx, sy: screen positions; sz: view depth (larger is farther); sw: 1/w for perspective-correct interpolation.
    vcol: a colour per vertex (N,3), multiplied into the texture's.
    mode 0: textured toon; mode 1: flat vertex colour (outline); mode 2: vertex colour toon plus the texture times add (hair's
    highlight band). cull: +1 faces turned to the camera, -1 the others, 0 all.
    lit_always: no shadow (faces). Lighting is worked in linear light, as Unity's linear colour space does: the key light gives
    the two tones, a fill light (fill: its direction, fill_col: linear colour times intensity) adds where it reaches."""
    H, W = depth.shape
    for t in range(tris.shape[0]):
        a, b, c = tris[t, 0], tris[t, 1], tris[t, 2]
        if cull != 0:
            fz = nrm[a, 2] + nrm[b, 2] + nrm[c, 2]
            if cull > 0 and fz > 0:
                continue
            if cull < 0 and fz <= 0:
                continue
        x0, y0, x1, y1, x2, y2 = sx[a], sy[a], sx[b], sy[b], sx[c], sy[c]
        if sz[a] <= 0 or sz[b] <= 0 or sz[c] <= 0:
            continue
        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if area == 0:
            continue
        minx = max(int(np.floor(min(x0, min(x1, x2)))), 0)
        maxx = min(int(np.ceil(max(x0, max(x1, x2)))), W - 1)
        miny = max(int(np.floor(min(y0, min(y1, y2)))), 0)
        maxy = min(int(np.ceil(max(y0, max(y1, y2)))), H - 1)
        for py in range(miny, maxy + 1):
            for px in range(minx, maxx + 1):
                fx = px + 0.5
                fy = py + 0.5
                w0 = ((x1 - fx) * (y2 - fy) - (x2 - fx) * (y1 - fy)) / area
                w1 = ((x2 - fx) * (y0 - fy) - (x0 - fx) * (y2 - fy)) / area
                w2 = 1.0 - w0 - w1
                if w0 < 0 or w1 < 0 or w2 < 0:
                    continue
                z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c]
                if z >= depth[py, px]:
                    continue
                q0 = w0 * sw[a]
                q1 = w1 * sw[b]
                q2 = w2 * sw[c]
                qs = q0 + q1 + q2
                vc0 = (q0 * vcol[a, 0] + q1 * vcol[b, 0] + q2 * vcol[c, 0]) / qs
                vc1 = (q0 * vcol[a, 1] + q1 * vcol[b, 1] + q2 * vcol[c, 1]) / qs
                vc2 = (q0 * vcol[a, 2] + q1 * vcol[b, 2] + q2 * vcol[c, 2]) / qs
                if mode == 1:
                    if tex.shape[0] > 1:
                        # The outline is cut where the surface is: through a texture's holes (lace) there's none.
                        u = (q0 * uv[a, 0] + q1 * uv[b, 0] + q2 * uv[c, 0]) / qs
                        v = (q0 * uv[a, 1] + q1 * uv[b, 1] + q2 * uv[c, 1]) / qs
                        if _sample(tex, u, v)[3] < cutoff:
                            continue
                    depth[py, px] = z
                    color[py, px, 0] = vc0
                    color[py, px, 1] = vc1
                    color[py, px, 2] = vc2
                    color[py, px, 3] = 1.0
                    continue
                u = (q0 * uv[a, 0] + q1 * uv[b, 0] + q2 * uv[c, 0]) / qs
                v = (q0 * uv[a, 1] + q1 * uv[b, 1] + q2 * uv[c, 1]) / qs
                if tex.shape[0] > 1:
                    s = _sample(tex, u, v)
                else:
                    s = np.ones(4)
                if mode != 2 and s[3] < cutoff:
                    continue
                n0 = (q0 * nrm[a, 0] + q1 * nrm[b, 0] + q2 * nrm[c, 0]) / qs
                n1 = (q0 * nrm[a, 1] + q1 * nrm[b, 1] + q2 * nrm[c, 1]) / qs
                n2 = (q0 * nrm[a, 2] + q1 * nrm[b, 2] + q2 * nrm[c, 2]) / qs
                nl = np.sqrt(n0 * n0 + n1 * n1 + n2 * n2)
                if nl > 0:
                    n0 /= nl
                    n1 /= nl
                    n2 /= nl
                lit = 1.0
                if not lit_always:
                    d = n0 * light[0] + n1 * light[1] + n2 * light[2]
                    # A soft step, a few hundredths wide, as the game's ramps blend.
                    lit = min(max((d + 0.02) / 0.08, 0.0), 1.0)
                df = max(n0 * fill[0] + n1 * fill[1] + n2 * fill[2], 0.0)
                depth[py, px] = z
                if mode == 2:
                    col = (vc0, vc1, vc2)
                else:
                    col = (s[0] * vc0, s[1] * vc1, s[2] * vc2)
                for k in range(3):
                    lin = max(col[k], 0.0) ** 2.2
                    tone = lit + (1.0 - lit) * shade[k] ** 2.2
                    out = lin * (tone + fill_col[k] * df)
                    if mode == 2:
                        out += (s[k] * add[k]) ** 2.2 * (0.4 + 0.6 * lit)
                    color[py, px, k] = min(out, 1.0) ** (1.0 / 2.2)
                color[py, px, 3] = 1.0
