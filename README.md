# Speaking Partner

Luyện nói tiếng Anh với AI nhập vai, nói chuyện bằng giọng nói như ngoài đời thật.

- **Giao diện:** React + Vite + Framer Motion.
- **Nhận giọng nói và đọc câu trả lời:** dùng sẵn trong Chrome (Web Speech API), miễn phí.
- **AI trò chuyện:** model `llama3.2:3b` chạy trên máy bằng Ollama, miễn phí, không cần API key.

## Chạy trên máy

```bash
./start.sh        # bật Ollama + trang web tại http://localhost:8765
./start.sh ai     # chỉ bật Ollama (khi dùng trang đã deploy lên Vercel)
```

Mở bằng **Chrome** và cho phép dùng micro. Phần nhận giọng nói của Chrome cần Internet.

## Deploy lên Vercel

```bash
. ./env.sh                # dùng Node 20 trong thư mục .node
npx vercel@latest         # lần đầu: đăng nhập, chọn Framework "Vite"
npx vercel@latest --prod
```

Bạn cũng có thể đẩy thư mục này lên GitHub rồi Import trên vercel.com. Vercel tự nhận ra Vite: build `npm run build`, output `dist`.

AI vẫn chạy trên máy của bạn. Trang trên Vercel gọi tới `http://localhost:11434`, vì vậy:

- Trên máy đang mở trang, phải chạy `./start.sh ai`. Script đã cho phép các trang `https://*.vercel.app`.
- Lần đầu mở, Chrome hỏi quyền truy cập thiết bị trong mạng cục bộ. Hãy bấm **Cho phép**.
- Mở từ điện thoại hay máy khác thì không có AI. Nếu muốn dùng ở mọi nơi, cần đổi sang một AI trên cloud.
