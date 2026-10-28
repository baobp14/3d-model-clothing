import json
import logging
import re
import urllib.request
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

logger = logging.getLogger('stylist')

CATALOG_CONTEXT = """
DANH MỤC TRANG PHỤC THỜI TRANG N&B SẴN CÓ TRONG KHO VÀ PHÒNG THỬ ĐỒ 3D:
1. Áo thun (T-Shirts):
   - Áo thun in hình Dfys Graphic Cream (Mã: alyxen_dfys_graphic_cream, Màu: Be/Kem, Giá: 199.000₫, Phom: Regular, Trẻ trung Unisex)
   - Áo thun Tidebreaker Graphic Grey (Mã: jtd_tidebreaker_heavy_graphic_t_shirt, Màu: Xám, Giá: 249.000₫, Phom: Relaxed năng động)
   - Áo thun Sunny Parade (Mã: jtd_sunny_parade_heavy_graphic_t_shirt, Màu: Trắng ngà, Giá: 229.000₫, Phom: Tươi sáng mùa hè)
   - Áo thun Blind Surveillance Grey (Mã: jtd_blind_surveillance_heavy_graphic_t_shirt_grey, Màu: Xám đậm, Giá: 259.000₫, Phom: Streetwear cá tính)
   - Áo thun Midnight Jester Grey (Mã: jtd_midnight_jester_heavy_graphic_t_shirt_grey, Màu: Xám tiêu, Giá: 249.000₫)
2. Áo Sơ Mi (Shirts):
   - Áo Sơ mi Oxford Light Blue (Mã: ascolour_5401_oxford_shirt_light_blue, Màu: Xanh nhạt Oxford, Giá: 350.000₫, Phom: Regular công sở, lịch thiệp)
   - Áo Sơ mi Trắng Cổ Điển Oxford (Mã: ascolour_5401_oxford_shirt_white, Màu: Trắng tinh khôi, Giá: 320.000₫, Phom: Thanh lịch cao cấp)
3. Quần & Chân Váy (Bottoms):
   - Quần Tây Ống Đứng Regular Trousers (Mã: pants, Màu: Đen, Giá: 399.000₫, Tôn dáng, thanh thoát)
   - Quần Short Năng Động (Mã: shorts, Màu: Đen, Giá: 220.000₫, Trẻ trung, thoải mái)
   - Chân Váy Nữ A-Line Skirt (Mã: skirt, Màu: Đen, Giá: 280.000₫, Duyên dáng thời thượng)
"""

SYSTEM_PROMPT = f"""Bạn là N&B AI Stylist - Trợ lý Thời trang & Chuyên gia tư vấn định hình phong cách cá nhân độc quyền của thương hiệu N&B Fashion.
N&B là thương hiệu thời trang cao cấp tích hợp phòng thử đồ 3D vật lý (Virtual Try-On) thời gian thực trên trình duyệt.

{CATALOG_CONTEXT}

QUY TẮC TƯ VẤN CỦA N&B AI STYLIST:
1. Luôn chào hỏi thân thiện, thanh lịch, am hiểu xu hướng thời trang và tone giọng chuyên nghiệp, sang trọng.
2. Nếu khách cung cấp Chiều cao & Cân nặng (hoặc trong thông tin kèm theo):
   - Nhận xét vóc dáng khách quan, tinh tế (ví dụ: 1m72 55kg là vóc dáng thon gọn, thanh thoát).
   - Đề xuất chính xác Size áo quần N&B (dưới 62kg -> Size S thon gọn; 63-78kg -> Size M/L; trên 78kg -> Size XL).
3. Gợi ý cụ thể từ 1 đến 2 Combo Trang Phục hoàn chỉnh (kết hợp 1 Áo + 1 Quần/Váy) phù hợp nhất với yêu cầu của khách (đi cà phê, dạo phố, công sở, tiệc tối, phong cách tối giản Minimalist, năng động Streetwear...).
4. GIẢI THÍCH LÝ DO PHỐI: Tại sao màu sắc và chất liệu vải của 2 món đó lại hài hòa với nhau (ví dụ: Áo thun màu kem ấm kết hợp cùng Quần dài đen tạo độ tương phản thanh lịch).
5. KÈM THEO LIÊN KẾT ĐỊNH DANH COMBO để hệ thống tạo thẻ Combo Mua Sắm:
   - Cú pháp bắt buộc: [✨ Thêm Combo này vào giỏ hàng](/try-on?top=<mã_áo>&bottom=<mã_quần>&size=<S/M/L>)
   - Ví dụ: [✨ Thêm Combo Dạo Phố vào giỏ](/try-on?top=alyxen_dfys_graphic_cream&bottom=pants&size=S)
6. Độ dài & Định dạng: Trả lời súc tích, ngắn gọn (khoảng 100-180 từ), thanh lịch, không lan man. Dùng gạch đầu dòng rõ ràng.
   BẮT BUỘC ở cuối mỗi combo đề xuất, bạn PHẢI chèn đúng một liên kết combo dạng markdown:
   [✨ Thêm Combo này vào giỏ hàng](/try-on?top=<mã_áo>&bottom=<mã_quần>&size=<S/M/L>)
"""

class StylistMessage(BaseModel):
    role: str
    content: str

class StylistPayload(BaseModel):
    message: str
    history: Optional[List[StylistMessage]] = None
    measurements: Optional[Dict[str, Any]] = None

def ask_stylist(api_key: str, payload: StylistPayload) -> Dict[str, Any]:
    # Try gemini models in order
    models = ["gemini-2.5-flash", "gemini-flash-lite-latest"]

    contents = []
    # Add history (last 6 messages max for context)
    if payload.history:
        for msg in payload.history[-6:]:
            role = "user" if msg.role == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg.content}]
            })

    # Prepare user prompt with measurement context if available
    user_text = payload.message
    height = None
    weight = None
    if payload.measurements:
        m = payload.measurements
        height = m.get('height')
        weight = m.get('weight')
        g = 'Nam' if m.get('gender') == 'male' else ('Nữ' if m.get('gender') == 'female' else '')
        extra_ctx = []
        if g: extra_ctx.append(f"Giới tính: {g}")
        if height: extra_ctx.append(f"Chiều cao: {height}cm")
        if weight: extra_ctx.append(f"Cân nặng: {weight}kg")
        if extra_ctx:
            user_text += f"\n\n[Thông tin số đo của tôi: {', '.join(extra_ctx)}]"

    contents.append({
        "role": "user",
        "parts": [{"text": user_text}]
    })

    req_body = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048
        }
    }

    reply_text = ""
    last_err = None

    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(req_body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                candidates = data.get('candidates', [])
                if candidates:
                    parts = candidates[0].get('content', {}).get('parts', [])
                    if parts and 'text' in parts[0]:
                        reply_text = parts[0]['text']
                        break
        except Exception as e:
            logger.warning(f"Stylist model {model_name} failed: {e}")
            last_err = e
            continue

    # Graceful fallback if API is unreachable or exhausted
    if not reply_text:
        # Determine recommended size
        size = "M"
        if weight:
            try:
                w_val = float(weight)
                if w_val < 62:
                    size = "S"
                elif w_val > 78:
                    size = "XL"
                elif w_val > 70:
                    size = "L"
            except Exception:
                size = "M"

        msg_lower = payload.message.lower()
        if "công sở" in msg_lower or "đi làm" in msg_lower or "lịch sự" in msg_lower or "sơ mi" in msg_lower:
            reply_text = f"""Chào bạn! Với nhu cầu đi làm và công sở thanh lịch, N&B Stylist xin gợi ý set đồ chuẩn mực:

- **Áo Sơ mi Oxford Light Blue** (350.000₫) kết hợp cùng **Quần Tây Ống Đứng Regular Trousers** (399.000₫).
- Gam màu xanh nhạt Oxford mang lại sự chỉn chu, tươi sáng, kết hợp phom quần tây đen tôn dáng đĩnh đạc.
- Đề xuất Size phù hợp nhất: **Size {size}**.

Bạn có thể mặc thử ngay trên người mẫu 3D:
[✨ Mặc thử Set Công Sở Thanh Lịch](/try-on?top=ascolour_5401_oxford_shirt_light_blue&bottom=pants&size={size})"""
        else:
            reply_text = f"""Chào bạn! Để đi cà phê hoặc dạo phố cuối tuần thoải mái và trẻ trung, N&B Stylist đề xuất set đồ cực 'cháy':

- **Áo thun Dfys Graphic Cream** (199.000₫) phối cùng **Quần Tây Ống Đứng Regular Trousers** (399.000₫).
- Tông màu kem ấm áp của áo thun tương phản sang trọng với quần đen, tạo nét tối giản (Minimalist) hiện đại.
- Đề xuất Size phù hợp nhất: **Size {size}**.

Mời bạn trải nghiệm ngay trên phòng thử đồ 3D:
[✨ Mặc thử Set Dạo Phố Trẻ Trung](/try-on?top=alyxen_dfys_graphic_cream&bottom=pants&size={size})"""

    # Extract 3D try-on links from text to create structured outfit recommendations
    outfits = []
    # Match markdown links: [Label](/try-on?...)
    for label, link in re.findall(r'\[([^\]]+)\]\((/try-on\?[^\)]+)\)', reply_text):
        params = dict(re.findall(r'([a-zA-Z0-9_]+)=([a-zA-Z0-9_]+)', link))
        outfits.append({
            "label": label.strip(),
            "url": link.strip(),
            "top": params.get('top'),
            "bottom": params.get('bottom'),
            "size": params.get('size', 'S')
        })

    # If no markdown links found, look for raw /try-on URLs
    if not outfits:
        for link in re.findall(r'(/try-on\?[a-zA-Z0-9_=&-]+)', reply_text):
            params = dict(re.findall(r'([a-zA-Z0-9_]+)=([a-zA-Z0-9_]+)', link))
            outfits.append({
                "label": "Mặc thử set này trên 3D",
                "url": link.strip(),
                "top": params.get('top'),
                "bottom": params.get('bottom'),
                "size": params.get('size', 'S')
            })

    return {
        "reply": reply_text,
        "outfits": outfits
    }
