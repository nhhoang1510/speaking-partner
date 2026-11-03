# Speaking Partner

Luyện nói tiếng Anh với AI nhập vai, nói chuyện bằng giọng nói như ngoài đời thật.

- **Giao diện:** React + Vite + Framer Motion.
- **Nhận giọng nói và đọc câu trả lời:** dùng sẵn trong Chrome (Web Speech API), miễn phí.
- **AI trò chuyện**, chọn trong Cài đặt:
  - **Cloud (Groq)**: mặc định khi mở trang từ Vercel, dùng được trên điện thoại. Hàm `api/chat.js` của Vercel giữ API key `GROQ_API_KEY` (gói miễn phí của Groq) và gọi Groq thay cho trình duyệt.
  - **Ollama trên máy**: model `llama3.2:3b` chạy ngay trên laptop, miễn phí, không cần key.

## Cấu hình AI cloud (một lần)

1. Tạo API key tại https://console.groq.com/keys.
2. Vào Vercel → project `speaking-partner` → Settings → Environment Variables, thêm `GROQ_API_KEY` = key vừa tạo.
3. Có thể thêm `GROQ_MODEL` để đổi model (mặc định `llama-3.3-70b-versatile`).
4. Vào Deployments và chọn Redeploy.

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

Trên trang Vercel, AI mặc định là Cloud (Groq), dùng được trên mọi thiết bị kể cả điện thoại. Xem mục "Cấu hình AI cloud" ở trên.

Nếu muốn dùng Ollama trên máy với trang Vercel, chọn "Ollama trên máy" trong Cài đặt:

- Trên máy đang mở trang, phải chạy `./start.sh ai`. Script đã cho phép các trang `https://*.vercel.app`.
- Lần đầu mở, Chrome hỏi quyền truy cập thiết bị trong mạng cục bộ. Hãy bấm **Cho phép**.

## Dùng trên điện thoại

- Android: dùng Chrome. iPhone: dùng Safari hoặc Chrome. Cho phép micro khi được hỏi.
- Bấm nút micro để nói. Ngừng nói khoảng 1 giây là lượt nói tự kết thúc.
- Nếu không nghe thấy tiếng AI, hãy tắt chế độ im lặng của máy.
