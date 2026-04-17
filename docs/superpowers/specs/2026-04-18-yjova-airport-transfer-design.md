# YJOVA 車來了 - 機場接送預約系統規格文件

**版本**：1.0
**更新日期**：2026-04-18
**客戶**：硬派租賃有限公司

---

## 1. 系統願景與目標

### 1.1 核心願景

打造一個以 LINE 生態系為核心的機場接送預約平台，讓客戶能夠在 LINE 內完成從叫車到付款的全部流程，司機能透過 LINE 接收任務並回報狀態，管理員能夠高效調度並監控全盤訂單。

### 1.2 現有痛點

- 車行手動派車，有遺忘風險
- 司機可能睡過頭忘記預約任務
- 現場總機需要同時操作多個 App（LINE、Zello對講機）
- 客戶不清楚是否已準確派車
- 通知費用（Push API）成本過高

### 1.3 設計理念

- **LINE 作為唯一前台**：所有操作在 LINE 內完成，減少多App切換
- **免費優先**：客戶端使用 Reply API（30天有效期 token），管理員使用 Telegram Bot
- **省費用的自動化**：每小時自動計算報表，管理員主動查詢而非被動推播

---

## 2. 系統架構

### 2.1 技術棧

| 層面 | 技術 |
|------|------|
| **前端** | React 19 + Vite + TypeScript |
| **樣式** | Tailwind CSS（CDN） |
| **後端** | Node.js + Express |
| **資料庫** | SQLite（小型、部署簡單） |
| **部署** | Docker + Nginx（VPS） |
| **外部整合** | LINE Messaging API / LIFF, Telegram Bot, Google Gemini |

### 2.2 三端 LIFF 設計

| 端 | LIFF 路徑 | 功能 |
|----|-----------|------|
| **客戶端** | `/customer` | 叫車、付款、查看司機資訊、行程歷史 |
| **司機端** | `/driver` | 接收訂單、承接/拒絕、確認出發、完成行程 |
| **管理端** | `/admin` | 調度指派、訂單總表、司機狀態、警示牆 |

### 2.3 系統架構圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LINE 生態系                                    │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │  客戶端   │    │  司機端   │    │  管理端   │    │   LINE OA       │   │
│  │  (LIFF)  │    │  (LIFF)  │    │  (LIFF)  │    │   圖文選單       │   │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────────┬─────────┘   │
│       │               │               │                   │             │
│       └───────────────┴───────────────┴───────────────────┘             │
│                              │                                          │
│                    LINE Login / LIFF SDK                                │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          VPS (Docker 部署)                               │
│                                                                         │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐            │
│   │   Nginx      │      │   Node.js   │      │   SQLite    │            │
│   │   (反向代理)   │────▶│   API Server │◄───▶│   資料庫     │            │
│   │   Port 80    │      │   Express    │      │             │            │
│   └─────────────┘      └──────┬──────┘      └─────────────┘            │
│                                │                                       │
│                    ┌───────────┼───────────┐                          │
│                    │           │           │                          │
│            ┌──────┴─────┐ ┌────┴────┐ ┌────┴────┐                     │
│            │ LINE SDK   │ │Telegram │ │Gemini   │                     │
│            │ Webhook    │ │Bot      │ │AI Service│                     │
│            └────────────┘ └─────────┘ └─────────┘                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 資料庫設計

### 3.1 資料庫 Schema

```sql
-- 用戶表（統一）
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    line_user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT CHECK(role IN ('CUSTOMER', 'DRIVER', 'ADMIN')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 司機詳細資料
CREATE TABLE drivers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    license_plate TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_photo_url TEXT,
    rating REAL DEFAULT 5.0,
    total_rides INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('AVAILABLE', 'BUSY', 'OFFLINE')) DEFAULT 'OFFLINE',
    is_confirmed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 預約訂單
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    driver_id TEXT,
    pickup_address TEXT NOT NULL,
    dropoff_address TEXT NOT NULL,
    pickup_time DATETIME NOT NULL,
    passenger_count INTEGER DEFAULT 1,
    luggage_count INTEGER DEFAULT 0,
    flight_number TEXT,
    notes TEXT,
    estimated_fare REAL NOT NULL,
    actual_fare REAL,
    payment_status TEXT CHECK(payment_status IN ('UNPAID', 'PAID', 'REFUNDED')) DEFAULT 'UNPAID',
    payment_method TEXT,
    booking_type TEXT CHECK(booking_type IN ('IMMEDIATE', 'SCHEDULED')) DEFAULT 'SCHEDULED',
    category TEXT CHECK(category IN ('GENERAL', 'AIRPORT')) DEFAULT 'AIRPORT',
    status TEXT CHECK(status IN ('PENDING', 'ASSIGNED', 'CONFIRMED', 'STARTING', 'COMPLETED', 'CANCELLED')) DEFAULT 'PENDING',
    reply_token TEXT,
    reply_token_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
);

-- 通知日誌
CREATE TABLE notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id TEXT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    channel TEXT CHECK(channel IN ('LINE_REPLY', 'LINE_PUSH', 'TELEGRAM')) NOT NULL,
    content TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 系統設定
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 4. 免費通知策略

### 4.1 LINE Reply API（客戶端）

當客戶從 LINE 圖文選單點擊按鈕進入 LIFF 時：
1. Webhook 事件觸發，系統取得空白 reply token
2. 立即回覆歡迎訊息（免費）
3. **儲存 reply token + 有效期限（30天）** 到資料庫

之後30天內所有回覆都使用儲存的 token，**完全免費**。

### 4.2 Telegram Bot（管理員）

管理員通知使用 Telegram Bot，**完全免費且無數量限制**。

### 4.3 通知時機

| 時機 | 對象 | 方式 | 費用 |
|------|------|------|------|
| 客戶進入 LIFF | 客戶 | Reply API | 免費 |
| 預約成功 | 客戶 | Reply API（存儲的 token） | 免費 |
| 司機承接 | 客戶 | Reply API（存儲的 token） | 免費 |
| 司機出發前30分鐘 | 司機 | LIFF 內查詢（被動） | 免費 |
| 管理員每小時報表 | 管理員 | Telegram Bot | 免費 |

---

## 5. 核心功能模組

### 5.1 客戶端 LIFF（/customer）

#### 5.1.1 叫車流程

1. **選擇服務類型**
   - 機場接送（桃園 TPE、松山 TSA）
   - 去/回機場方向選擇
   - 航班號碼輸入（optional）

2. **填寫預約資訊**
   - 上車/下地點（一般/自動帶入機場）
   - 乘車時間（即時/預約）
   - 乘客人數、行李件數
   - 備註

3. **AI 試算車資**
   - 使用 Gemini 估算行車距離
   - 根據系統設定計算車資
   - 顯示距離與預估費用

4. **付款**
   - 信用卡（預留）
   - LINE Pay（預留）
   - 街口支付（預留）
   - **模擬付款按鈕**（當前階段）

5. **預約成功**
   - 免費 Reply 回覆確認
   - 提供查詢按鈕（查看狀態）

#### 5.1.2 司機卡顯示

當司機被指派後，客戶可在 LIFF 查看：
- 司機姓名
- 車牌號碼
- 車型
- 司機電話（一鍵撥打）
- 預計抵達時間

#### 5.1.3 行程歷史

客戶可查看所有歷史預約，顯示狀態、司機資訊、費用。

---

### 5.2 司機端 LIFF（/driver）

#### 5.2.1 任務接收

當管理員指派訂單後，司機會收到通知（在 LIFF 內）：
- 顯示訂單詳情
- 「承接」/「拒絕」按鈕

#### 5.2.2 承接/拒絕

- **承接**：系統回覆客戶，司機卡正式生效
- **拒絕**：通知管理員重新指派

#### 5.2.3 出發確認

當預約時間前 30 分鐘，司機需在 LIFF 確認：
- 「已出發」按鈕
- 若未確認，系統通知管理員（警示牆）

#### 5.2.4 完成行程

司機抵達目的地後，點擊「完成行程」。

---

### 5.3 管理端 LIFF（/admin）

#### 5.3.1 調度儀表板

- **待指派訂單列表**
  - 顯示未來 2 小時內的訂單
  - 狀態：未派車/已派車/司機已出發

- **司機狀態牆**
  - 上線司機數量
  - 目前任務中的司機
  - 離線司機

- **警示牆**
  - 司機未及時確認出發
  - 訂單逾時未指派

#### 5.3.2 指派司機

- 選擇待指派訂單
- 從上線司機清單中選擇
- 點擊確認，系統自動：
  - 更新訂單狀態
  - 使用 Reply API 發送司機卡給客戶

#### 5.3.3 每小時自動報表

- 每天固定時間生成隔日預約總表
- 每小時計算未來 2 小時訂單狀態
- 透過 Telegram Bot 發送給管理員（免費）

#### 5.3.4 司機管理

- 新增/編輯司機資料
- 強制上線/離線
- 查看司機歷史表現

#### 5.3.5 費率設定

- 起步價
- 每公里費率
- 夜間加成（可選）

---

## 6. LINE 圖文選單設計

### 6.1 客戶視角（圖文選單按鈕）

```
┌─────────────────────────────────┐
│  🎫 立即叫車                    │ → 進入客戶 LIFF
│  📋 查詢訂單                    │ → 進入客戶 LIFF 歷史頁
│  📞 聯絡我們                    │ → 開啟 LINE 客服聊天
└─────────────────────────────────┘
```

### 6.2 司機視角（獨立 QR Code）

司機透過獨立 QR Code 加入司机端 LIFF，避免與客戶混淆。

### 6.3 管理端視角（獨立連結）

管理員透過獨立 URL 加入管理端 LIFF。

---

## 7. 自動化排程設計

### 7.1 排程任務

| 任務 | 時間 | 動作 |
|------|------|------|
| 每小時報表 | `0 * * * *` | 透過 Telegram 發送未來2小時訂單狀態 |
| 每日總表 | `20:00` | 發送隔日預約單總表（已/未指派） |
| 出發前 30 分鐘 | 動態計算 | 提醒司機確認（LIFF 內） |
| 出發前 2 小時 | 動態計算 | 有司機→發司機卡；無司機→發警示 |

### 7.2 警示條件

| 條件 | 動作 |
|------|------|
| 司機未在 30 分鐘前確認出發 | 顯示在管理端警示牆 + Telegram 通知 |
| 訂單逾時未指派（> 30 分鐘） | 顯示在管理端警示牆 |
| 司機拒絕任務 | 立即通知管理員重新指派 |

---

## 8. 配色系統

### 8.1 色彩定義

| 名稱 | 色值 | 用途 |
|------|------|------|
| **Primary** | `#FF8C00` | 強調色、按鈕、重要資訊 |
| **Primary Hover** | `#E07B00` | 按鈕 hover 狀態 |
| **Background** | `#F5F7FA` | 頁面背景 |
| **Surface** | `#FFFFFF` | 卡片背景 |
| **Text Primary** | `#2D3748` | 主要文字 |
| **Text Secondary** | `#718096` | 次要文字、說明 |
| **Border** | `#E2E8F0` | 邊框、分隔線 |
| **Success** | `#38A169` | 成功狀態 |
| **Warning** | `#DD6B20` | 警告狀態 |
| **Error** | `#E53E3E` | 錯誤狀態 |

### 8.2 字體

- 主要字體：Inter, Microsoft JhengHei, sans-serif

---

## 9. API 端點設計

### 9.1 客戶端

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/booking` | 建立新預約 |
| GET | `/api/booking/:id` | 取得預約詳情 |
| GET | `/api/bookings/customer/:lineUserId` | 取得客戶所有預約 |
| POST | `/api/booking/:id/pay` | 付款（模擬） |

### 9.2 司機端

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/driver/:lineUserId/tasks` | 取得司機任務清單 |
| POST | `/api/driver/task/:bookingId/accept` | 承接任務 |
| POST | `/api/driver/task/:bookingId/reject` | 拒絕任務 |
| POST | `/api/driver/task/:bookingId/confirm-start` | 確認出發 |
| POST | `/api/driver/task/:bookingId/complete` | 完成行程 |

### 9.3 管理端

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/admin/bookings` | 取得所有預約（可篩選狀態） |
| GET | `/api/admin/drivers` | 取得所有司機 |
| POST | `/api/admin/booking/:id/assign` | 指派司機 |
| GET | `/api/admin/dashboard` | 取得儀表板資料 |
| PUT | `/api/admin/settings` | 更新系統設定 |

### 9.4 Webhook

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/webhook/line` | LINE Messaging API Webhook |
| POST | `/webhook/telegram` | Telegram Bot Webhook |

---

## 10. LINE 整合流程

### 10.1 客戶首次進入流程

```
1. 客戶點擊 LINE 圖文選單「立即叫車」
       ↓
2. LINE 發送 webhook（postback/richmenu 點擊事件）
       ↓
3. 系統接收，回覆歡迎訊息（Reply API，免費）
       ↓
4. 儲存 line_user_id + reply_token + 有效期限（30天）
       ↓
5. 客戶進入 LIFF 頁面，帶有 line_user_id 參數
       ↓
6. 客戶填單、付款
       ↓
7. 系統回覆預約成功（Reply API，使用儲存的 token，免費）
```

### 10.2 司機承接流程

```
1. 管理員指派司機
       ↓
2. 系統更新 booking.driver_id + status = 'ASSIGNED'
       ↓
3. 系統使用客戶的 reply_token 回覆司機卡（免費）
       ↓
4. 司機在 LIFF 看到新任務
       ↓
5. 司機點擊「承接」
       ↓
6. 系統更新 status = 'CONFIRMED'
       ↓
7. 系統使用客戶的 reply_token 回覆「司機已確認」（免費）
```

### 10.3 出發前提醒流程

```
1. 排程任務觸發（預約前 30 分鐘）
       ↓
2. 檢查司機是否已確認出發（is_confirmed）
       ↓
3. 若未確認：
   - 在管理端警示牆顯示
   - 透過 Telegram 通知管理員
```

---

## 11. 部署架構

### 11.1 Docker 部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/yjova.db
    volumes:
      - ./data:/app/data
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

### 11.2 Nginx 設定

- 反向代理到 Node.js app（port 3000）
- SSL 終端（Let's Encrypt）
- LIFF 所需的 redirect_uri 設定

---

## 12. 模擬付款功能（當前階段）

由於金流 API 文件尚未取得，目前實作模擬付款：

- 顯示所有支付方式選項（LINE Pay、街口、信用卡）
- 提供「模擬付款完成」按鈕
- 按下後直接將 payment_status 改為 'PAID'
- 顯示付款成功訊息

---

## 13. 待整合項目（未來）

| 項目 | 狀態 | 說明 |
|------|------|------|
| LINE Pay 整合 | 待取得 API 文件 | 實際金流串接 |
| 街口支付整合 | 待取得 API 文件 | 實際金流串接 |
| 信用卡整合 | 待取得 API 文件 | 實際金流串接 |
| GPS 追蹤 | 後續追加 | 即時司機位置追蹤 |
| B2B 月結 | 後續追加 | 企業客戶帳務 |

---

## 14. 成功標準

- ✅ 客戶可在 LINE 內完成叫車到付款全部流程
- ✅ 管理員可在 LINE 內完成指派車輛
- ✅ 司機可在 LINE 內接收任務並回報
- ✅ 所有 LINE 通知使用 Reply API，零 Push API 費用
- ✅ 管理員通知使用 Telegram Bot，零費用
- ✅ 系統自動化提醒減少人工作業遺漏