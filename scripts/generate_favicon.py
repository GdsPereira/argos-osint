"""Script to generate high-quality PNG and ICO favicons for Argos.
Uses Pillow to draw an antialiased Argos All-Seeing Eye sentinel emblem.
"""
import math
from PIL import Image, ImageDraw

def create_argos_icon(size=512):
    scale = size / 64.0
    # Create high-res canvas with 4x supersampling for ultra smooth antialiasing
    ss = 4
    canvas_size = size * ss
    s = canvas_size / 64.0

    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Background Squircle
    margin = 2 * s
    rect_box = [margin, margin, canvas_size - margin, canvas_size - margin]
    radius = 15 * s
    draw.rounded_rectangle(rect_box, radius=radius, fill=(9, 14, 26, 255), outline=(56, 189, 248, 255), width=int(1.8 * s))

    # 2. Target dashed ring
    # Draw subtle circular grid ring
    center = canvas_size / 2
    r_target = 22 * s
    draw.ellipse([center - r_target, center - r_target, center + r_target, center + r_target], outline=(56, 189, 248, 45), width=max(1, int(1 * s)))
    
    r_inner = 16 * s
    draw.ellipse([center - r_inner, center - r_inner, center + r_inner, center + r_inner], outline=(99, 102, 241, 75), width=max(1, int(1 * s)))

    # 3. Cardinal crosshair ticks
    tick_width = max(2, int(2 * s))
    draw.line([(center, 5 * s), (center, 10 * s)], fill=(56, 189, 248, 255), width=tick_width)
    draw.line([(center, 54 * s), (center, 59 * s)], fill=(56, 189, 248, 255), width=tick_width)
    draw.line([(5 * s, center), (10 * s, center)], fill=(56, 189, 248, 255), width=tick_width)
    draw.line([(54 * s, center), (59 * s, center)], fill=(56, 189, 248, 255), width=tick_width)

    # 4. Eye almond shape: composite of upper arc and lower arc
    # Sample points along cubic bezier curves for smooth polygon
    def bezier_curve(p0, p1, p2, p3, steps=60):
        points = []
        for i in range(steps + 1):
            t = i / steps
            x = (1-t)**3 * p0[0] + 3*(1-t)**2*t * p1[0] + 3*(1-t)*t**2 * p2[0] + t**3 * p3[0]
            y = (1-t)**3 * p0[1] + 3*(1-t)**2*t * p1[1] + 3*(1-t)*t**2 * p2[1] + t**3 * p3[1]
            points.append((x, y))
        return points

    # Upper eyelid: (10,32) -> control (17,19), (47,19) -> (54,32)
    upper = bezier_curve((10*s, 32*s), (17*s, 19*s), (47*s, 19*s), (54*s, 32*s), 50)
    # Lower eyelid: (54,32) -> control (47,45), (17,45) -> (10,32)
    lower = bezier_curve((54*s, 32*s), (47*s, 45*s), (17*s, 45*s), (10*s, 32*s), 50)
    eye_polygon = upper + lower

    # Fill eye inside with darker glass navy
    draw.polygon(eye_polygon, fill=(11, 17, 32, 210))
    # Outline eye with cyan/indigo
    draw.line(eye_polygon + [eye_polygon[0]], fill=(56, 189, 248, 255), width=max(2, int(3 * s)), joint="round")

    # 5. Iris circle
    r_iris = 8.5 * s
    draw.ellipse([center - r_iris, center - r_iris, center + r_iris, center + r_iris], fill=(7, 13, 29, 255), outline=(99, 102, 241, 255), width=max(2, int(2.2 * s)))

    # 6. Pupil with bright glowing core
    r_pupil = 4.2 * s
    draw.ellipse([center - r_pupil, center - r_pupil, center + r_pupil, center + r_pupil], fill=(56, 189, 248, 255))
    
    # Specular glint
    glint_x = 34 * s
    glint_y = 30 * s
    r_glint = 1.3 * s
    draw.ellipse([glint_x - r_glint, glint_y - r_glint, glint_x + r_glint, glint_y + r_glint], fill=(255, 255, 255, 255))

    # Downsample using LANCZOS for crisp, anti-aliased output
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

if __name__ == "__main__":
    icon_512 = create_argos_icon(512)
    icon_512.save("frontend/src/favicon.png", format="PNG")
    print("Generated frontend/src/favicon.png (512x512)")

    # Multi-size ICO
    icon_256 = icon_512.resize((256, 256), Image.Resampling.LANCZOS)
    icon_128 = icon_512.resize((128, 128), Image.Resampling.LANCZOS)
    icon_64 = icon_512.resize((64, 64), Image.Resampling.LANCZOS)
    icon_48 = icon_512.resize((48, 48), Image.Resampling.LANCZOS)
    icon_32 = icon_512.resize((32, 32), Image.Resampling.LANCZOS)
    icon_16 = icon_512.resize((16, 16), Image.Resampling.LANCZOS)

    icon_256.save(
        "frontend/src/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print("Generated frontend/src/favicon.ico (multi-size 16 to 256)")
