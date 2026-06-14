# TimeMarkApp

App chụp ảnh đóng dấu giờ/ngày/địa chỉ kiểu TimeMark, viết bằng React Native + Expo (SDK 54), chạy được trên **Expo Go**.

## Có gì trong app

4 tab dưới đáy:

| Tab | Chức năng |
|-----|-----------|
| **ẢNH** | Camera live có overlay TimeMark → chụp → xem lại ảnh đã đóng dấu → lưu vào thư viện |
| **SỬA ẢNH** | Chọn 1 ảnh có sẵn (chưa có dấu) → đóng dấu TimeMark vào → lưu |
| **CÔNG CỤ** | Chỉnh giờ/ngày tuỳ chỉnh, tên, địa chỉ, mã xác minh — có xem trước trực tiếp |
| **VIDEO** | Để trống (làm sau) |

> Tab SỬA ẢNH thay cho vị trí "Báo cáo", tab CÔNG CỤ thay cho "Điểm danh" trong app gốc.
> Muốn đổi tên tab thì sửa mảng `TABS` trong `App.tsx`.

## Cách chạy (lần đầu)

Cần **Node.js 18+** trên máy tính.

```bash
# 1. Vào thư mục
cd TimeMarkApp

# 2. Cài thư viện (bắt buộc — folder này KHÔNG kèm node_modules)
npm install

# 3. Chạy dev server
npx expo start
```

Sau đó:
1. Cài app **Expo Go** trên điện thoại (Play Store / App Store) — bản này dùng **SDK 54**.
2. Quét mã QR hiện trong terminal bằng Expo Go (Android) hoặc Camera (iOS).
3. App mở lên. Cấp quyền **camera**, **vị trí**, **thư viện ảnh** khi được hỏi.

> Lưu ý: máy tính và điện thoại phải cùng mạng Wi-Fi. Nếu mạng chặn, chạy `npx expo start --tunnel`.

## Build ra file APK (cài cố định, không cần Expo Go)

Dùng EAS Build (build trên cloud, không cần Android Studio):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview   # ra file .apk tải về
```

## Cấu trúc code

```
App.tsx                      # khung + thanh tab dưới đáy
src/
  SettingsContext.tsx        # state dùng chung (tên, địa chỉ, giờ custom, mã)
  datetime.ts                # định dạng ngày giờ kiểu VN
  TimeMarkOverlay.tsx        # lớp dấu TimeMark (giao diện)
  TimeMarkCanvas.tsx         # ảnh + overlay, bọc ref để chụp lại thành ảnh
  screens/
    CameraScreen.tsx         # tab ẢNH
    EditPhotoScreen.tsx      # tab SỬA ẢNH
    ToolScreen.tsx           # tab CÔNG CỤ
    VideoScreen.tsx          # tab VIDEO (placeholder)
```

## Ghi chú kỹ thuật

- Ảnh được đóng dấu bằng cách: hiện ảnh + overlay trong 1 `View`, rồi dùng
  `react-native-view-shot` chụp lại `View` đó thành ảnh JPG → lưu bằng
  `expo-media-library`.
- Font tên ("Từ Thanh Hoài") đang dùng chữ đậm + đổ bóng để giả lập viền.
  Muốn giống hệt app gốc thì nhúng 1 font riêng (vd qua `expo-font`) rồi gán
  vào `styles.name` trong `TimeMarkOverlay.tsx`.
- Mã xác minh là sinh giả lập (chỉ để hiển thị), không phải hệ thống xác thực thật.
