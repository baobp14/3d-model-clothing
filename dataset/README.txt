Dataset anh san pham quan ao (90 mau, 14 kieu co anh chung).

dataset/<mau>/                  1 thu muc = 1 kieu + 1 mau vai
  front.jpg, back.jpg           anh trai phang truoc/sau -> in len mesh 3D
                                (chan vay Everlane: back = front, nguon khong co anh sau)
  extra_XX.jpg                  anh RIENG cua dung mau nay: nguoi mau mac, can chat vai...
  source.json                   link nguon + link goc tung anh; "style" neu co anh chung

dataset/_styles/<kieu>/         anh CHUNG cua ca kieu, luu 1 lan
  extra_XX.jpg                  shop chi chup nguoi mau mac MOT mau roi dung cho moi mau
  style.json                    link nguon, danh sach thu muc mau dung chung

Map sang DB: _styles -> product_images (theo san pham),
             <mau>/front,back -> garment_prints (theo mau),
             <mau>/extra      -> product_images kem mau.

AS Colour KHONG chup nguoi mau theo tung mau (chi co anh trai phang theo mau),
nen cac mau AS Colour chi co anh trai phang rieng + bo anh nguoi mau chung.

Tai lai anh phu: python tools/garment-pipeline/fetch_extra_images.py
Xu ly anh in:    node tools/garment-pipeline/build_prints.mjs

Nguon: AS Colour, Jump The Dark, Alyxen, Everlane. Ban quyen thuoc ve chu so
huu; chua xin phep dung cong khai -- chi dung cho do an.
