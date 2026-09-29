Dataset anh san pham quan ao (90 mau).

Moi thu muc = 1 mau (1 kieu + 1 mau vai):
  front.jpg    anh trai phang mat truoc  -> dung de in len mesh 3D
  back.jpg     anh trai phang mat sau    (chan vay Everlane: trung front.jpg, nguon khong co anh sau)
  extra_01.jpg ... extra_06.jpg
               anh phu cho gallery san pham: nguoi mau mac (truoc/sau/nghieng),
               anh can chat vai. Da thu nho toi da 1000px.
  source.json  link trang nguon, link goc tung anh (front, back, extra[]), ten kieu, mau

Luu y: anh phu cua AS Colour la anh chung cho CA KIEU -- nguoi mau co the mac
mau khac voi thu muc (vd so mi oxford xanh nhung anh nguoi mau mac mau trang).

Tai lai / bo sung anh phu: python tools/garment-pipeline/fetch_extra_images.py
Xu ly anh in cho web:       node tools/garment-pipeline/build_prints.mjs

Nguon: AS Colour, Jump The Dark, Alyxen, Everlane. Ban quyen thuoc ve chu so
huu; chua xin phep dung cong khai -- chi dung cho do an.
