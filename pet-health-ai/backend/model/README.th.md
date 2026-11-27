# การใช้งานโมเดล 3 ตัวใน Pet Health AI

ระบบมี MobileNetV3-Small, EfficientNet-B0 และ EfficientNet-B3 สำหรับจำแนกภาพเป็น 6 กลุ่ม โดยเลือกผลของโมเดลหนึ่งตัวให้หน้าเว็บ ไม่ได้เฉลี่ยคะแนนทั้งสามตัวเป็น Ensemble

ไฟล์เฉพาะ B3 รวมอยู่ใน **`model/b3/`** แล้ว ดู [รายการไฟล์ B3 และหน้าที่ของแต่ละไฟล์](b3/README.md) ส่วน `main.py` และหน้าเว็บยังเป็นส่วนที่ใช้ร่วมกับโมเดลอื่น

## ไฟล์ที่ใช้

ส่วนคำแนะนำด้วย Gemini แยกอยู่ใน [`llm/`](llm/README.md) แล้ว ดูคู่มือสำหรับ Prompt, Config, API และ Tests ของ LLM ที่ลิงก์นี้

| ไฟล์ในโฟลเดอร์ model | หน้าที่ |
|---|---|
| `mobilenet_model.pth` | น้ำหนัก MobileNetV3-Small เดิม |
| `efficientnet_model.pth` | น้ำหนัก EfficientNet-B0 เดิม |
| `b3/efficientnet_b3_model.pth` | น้ำหนัก B3 ที่ฝึกใน Colab และเลือกจากรอบรวมที่ 14 |
| `b3/efficientnet_b3_metadata.json` | ข้อมูล B3: ลำดับกลุ่ม วิธีเตรียมภาพ เวอร์ชันและค่าฝึก รวมถึง SHA-256 ของน้ำหนัก |
| `b3/b3_inference.py` | สร้าง B3 โหลดน้ำหนัก ตรวจ metadata และเตรียมภาพตาม Colab |
| `b3/tta_evaluation.py` | ฟังก์ชันประเมินเปิด–ปิด TTA |
| `b3/DL_EfficientNet_B3_Model.ipynb` | Notebook B3 บนคอม สำหรับเปิดใน Colab |
| `b3/tests/` | ไฟล์ทดสอบการเชื่อม B3 และ TTA |
| `main.py` | FastAPI ที่เชื่อมโมเดลทั้งสามกับหน้าเว็บ |

น้ำหนัก B3 ปัจจุบันอยู่ใน `model/b3/` การจัดโฟลเดอร์ไม่ได้ดาวน์โหลดหรือฝึกน้ำหนักทับ ไฟล์มีขนาด 43,355,019 ไบต์ และ SHA-256 ตรงกับ checkpoint ที่ประเมิน Test บน Drive:

```text
6e72dbfd51b70f52cd06036d95758faa63251a45e1962650a7958dd94c580aab
```

ข้อมูลประกอบมาจาก `model_metadata.json` ใน Run เดียวกันบน Drive แล้วเก็บในโปรเจกต์ชื่อ `efficientnet_b3_metadata.json` เพื่อระบุชัดว่าเป็นของ B3 โดยเพิ่ม SHA-256 จาก `test_metrics.json` เพื่อจับคู่น้ำหนักกับข้อมูลประกอบ

แหล่งอ้างอิง:

- [Notebook B3](https://colab.research.google.com/drive/1tY6YvLBDF70BnLh3MtgsqZL7PuObjVIK)
- [โฟลเดอร์ผลการทดลอง](https://drive.google.com/drive/folders/1RjCO1-nAH918kyB_KCjoivv-ef7QRN2V)
- [ไฟล์น้ำหนักต้นทาง](https://drive.google.com/file/d/1gRwW7e75ObnmVYrTODg9Uh1CRCcC7qRG/view)

## เปลี่ยนอะไรในโค้ด

1. เพิ่มการสร้าง `models.efficientnet_b3(weights=None)` และเปลี่ยนหัวจำแนกให้ตอบ 6 กลุ่ม
2. โหลด `efficientnet_b3_model.pth` ด้วย `weights_only=True` และตรวจให้ค่าน้ำหนักเข้ากับทุกชั้น
3. ตรวจว่า architecture, ลำดับชื่อกลุ่ม และ SHA-256 ตรงกับ metadata หากไม่ตรงจะหยุดพร้อมข้อผิดพลาด ไม่จับคู่ชื่อกลุ่มเองโดยเดา
4. ใช้การเตรียมภาพเฉพาะ B3 ตามการประเมินใน Colab
5. เพิ่ม B3 ใน `/predict` และ `/compare` รวมถึงสถานะผ่าน `/models`
6. ให้โหมด `auto` ส่งผล B3 ก่อน จึงใช้ B3 บนหน้าเว็บเดิมได้โดยไม่เปลี่ยนรูปแบบ JSON

## การเตรียมภาพของแต่ละโมเดล

| โมเดล | การเตรียมภาพ |
|---|---|
| MobileNetV3-Small | วิธีเดิม: ภาพ 6 มุมมอง ปรับขนาด 224×224 แล้วเฉลี่ยคะแนน TTA |
| EfficientNet-B0 | วิธีเดิม: ภาพ 6 มุมมอง ปรับขนาด 224×224 แล้วเฉลี่ยคะแนน TTA |
| EfficientNet-B3 | แก้ทิศทาง EXIF → RGB → เลือกภาพเดียวหรือสร้าง TTA 6 แบบตาม B0 → แต่ละแบบผ่าน Resize ด้านสั้น 320 ด้วย Bicubic → Center crop 300×300 → Tensor → Normalize |

B3 มี baseline แบบภาพเดียวตาม Test เดิม และเพิ่ม TTA 6 แบบตาม B0: ต้นฉบับ ปรับแสง ครอป เพิ่มความคม เพิ่มความสว่าง/คอนทราสต์ และกลับซ้าย–ขวา แล้วเฉลี่ยคะแนน Softmax ทุกโมเดลยังผ่าน CLIP คัดกรองก่อนทำนาย ดังนั้นผลวัดทั้งระบบที่มี CLIP ยังต้องแยกจากผลเฉพาะ B3 ใน Notebook

### Augmentation และ TTA ของ B3

น้ำหนัก B3 ปัจจุบันผ่าน Augmentation ตอน Train มาแล้ว ได้แก่สุ่มครอป พลิก หมุน และปรับแสง รายละเอียดอยู่ใน `training.train_transform` ของ metadata การเพิ่ม TTA เป็นการเปลี่ยนวิธีทำนาย ไม่ต้องฝึกน้ำหนักใหม่

TTA ใช้ 6 แบบคงที่ตาม B0 โดยแปลงภาพก่อนปรับขนาด B3 แล้วเฉลี่ย Softmax probabilities ของทั้งหก ไม่ปรับน้ำหนักและไม่สุ่มผลใหม่ในแต่ละคำขอ รายละเอียดแต่ละแบบอยู่ใน [คู่มือ B3](b3/README.md)

รายงาน Colab จัดใหม่เป็น **14.1 Train/กราฟประวัติ → 14.2 Validation ภาพเดียว → 14.3 Validation TTA 6 แบบ → 15.1 Test ภาพเดียว → 15.2 Test โหมดที่กำหนดและสรุปรวม** Validation ทั้งสองแบบมีตารางและกราฟแยกกัน ตั้ง `REPORT_USE_TTA = True/False` ใน 14.3 เพื่อเลือกโหมด Test 15.2 และสรุปรวมให้ตรงกับโปรเจกต์ ไม่เปลี่ยนโหมดของกราฟ 14.2/14.3 และไม่เลือกโหมดจาก Test มี Loss, Accuracy, Precision/Recall แบบ Macro, Macro F1 และรายงานรายกลุ่มครบตาม Checklist ผลอยู่ใน `reports/readable_v1_<รหัสน้ำหนัก>/` และรวมใน ZIP ขั้น 17

หาก Runtime หลุด รัน **1 → 2 → 14.1 → 14.2 → 14.3 → 15.1 → 15.2 → 17** ได้โดยไม่ฝึก 12–13 ใหม่ หากต้องการลองรูปตัวเองให้รัน 16 หลัง 14.2 สำหรับเปิดดูประวัติหรือผล Test ภาพเดียวที่บันทึกไว้แล้ว ใช้ 14.1 หรือ 15.1 ได้โดยไม่ต้องมีตัวแปรตอน Train

คัดลอก metadata ที่ส่งออกมาเข้าโฟลเดอร์ `model/b3` คู่กับน้ำหนักที่ตรงกัน ผลแนะนำ `inference.tta_mode` ใช้ประกอบการตัดสินใจตั้ง `B3_TTA_OVERRIDE` ในโค้ดเป็น `True` หรือ `False` แล้วรีสตาร์ต API ระบบไม่เลือกโหมดจาก metadata อัตโนมัติ ส่วน `preprocessing.tta=false` ยังคงบันทึกวิธีประเมิน baseline ในอดีต

**ขณะเพิ่มโค้ดยังไม่ได้วัด TTA บนภาพจริง:** ตัวเชื่อม Drive ดาวน์โหลดได้สูงสุด 256 MB แต่ ZIP มีขนาดประมาณ 704 MB จึงให้ Colab ที่เชื่อม Drive อยู่ทำการเปรียบเทียบ ผล Test เดิม 94.79% ยังเป็นผลแบบไม่ใช้ TTA และยังอ้างไม่ได้ว่า TTA แม่นขึ้น

ลำดับชื่อกลุ่มของ B3 ต้องเป็น:

```text
0 bacterial_dermatosis
1 demodicosis
2 dermatitis
3 fungal_infection
4 healthy
5 hypersensitivity
```

## วิธีเปิดใช้งาน

จากโฟลเดอร์โปรเจกต์ รัน API:

```powershell
cd model
python main.py
```

เปิดอีก Terminal จากราก Repository แล้วรันหน้าเว็บที่ตำแหน่งใหม่:

```powershell
cd frontend
npm run dev
```

หากยังไม่ได้ติดตั้งไลบรารี Python ให้ติดตั้งจาก `requirements.txt` ตาม README หลักก่อน ครั้งแรกที่โหลด CLIP อาจต้องใช้อินเทอร์เน็ต

เมื่อ API เริ่มทำงาน Terminal จะแจ้งการโหลดทั้งสามโมเดล หน้า `/check` ส่งรูปไป `/predict` แบบ `auto` ซึ่งเลือก B3 ก่อน หากไม่มี B3 จะใช้ลำดับสำรองตามเดิม ผู้ใช้ไม่ต้องเลือก TTA หรือภาพเดียวบนหน้าเว็บ

### ตั้งค่า TTA ฝั่ง API

แก้ `B3_TTA_OVERRIDE` ด้านบนของ `model/b3/b3_inference.py` แล้วรีสตาร์ต API: `True` = เปิด TTA 6 แบบ, `False` = ใช้ภาพเดียว ปัจจุบันคงค่าที่ผู้ใช้ตั้งไว้เป็น `True`

หน้าเว็บใช้ค่าจาก API โดยไม่ส่งพารามิเตอร์ TTA และไม่แสดงตัวเลือก โหมด หรือผลเปรียบเทียบให้ผู้ใช้ ส่วนการทดลองระหว่างพัฒนาใช้พารามิเตอร์ผ่าน `/docs` ตามหัวข้อด้านล่างได้ คะแนนที่สูงขึ้นของภาพเดียวไม่ได้ยืนยันว่าความแม่นยำของโมเดลดีขึ้น ต้องดูผล Validation/Test ด้วย

ทั้งสองโหมดใช้ไฟล์น้ำหนักเดิม ไม่ต้องเปิด Colab หรือฝึกใหม่ Colab ขั้น 14.2–14.3 และ 15.2 มีไว้ประเมินผลรวม เมื่อส่งออกจากขั้น 17 แล้วจึงนำ metadata ที่ตรงกับน้ำหนักมาอัปเดตในโปรเจกต์ และใช้ผลประเมินประกอบการตั้ง `B3_TTA_OVERRIDE` ด้วยตนเอง

เมื่ออัปโหลดภาพ API ยังพิมพ์ผลเปรียบเทียบโมเดลที่โหลดได้ใน Terminal ด้วย วิธีเตรียมภาพของแต่ละรุ่นต่างกัน จึงควรระบุวิธีเหล่านี้ประกอบเมื่อรายงานการเปรียบเทียบ

## เลือกโมเดลหรือเปรียบเทียบผ่าน API

เปิด `http://127.0.0.1:8000/docs` แล้วเลือก `POST /predict` → Try it out → เลือก `model_type` และรูป → Execute

| model_type | ผลตอบกลับ |
|---|---|
| `auto` | เลือก B3 ก่อน หากไม่มีจึงใช้ B0 ที่มีหัว 6 กลุ่ม / MobileNet ตามลำดับในโค้ด |
| `efficientnet_b3` | ผล B3 เท่านั้น |
| `efficientnet` | ผล B0 เดิมเท่านั้น |
| `mobilenet` | ผล MobileNet เดิมเท่านั้น |
| `all` | ผลของทั้งสามรุ่นแยกกัน |
| `both` | ชื่อโหมดเดิม รองรับต่อโดยส่งผลทั้งสามรุ่นเช่นเดียวกับ `all` |

`POST /compare` ส่งผลทั้งสามรุ่น โดยคงคีย์เดิม `mobilenet`, `efficientnet` และเพิ่ม `efficientnet_b3` ส่วนค่าของรุ่นที่ไม่มีไฟล์จะเป็น `null` หากระบุเลือกโมเดลที่ไม่พร้อมโดยตรง API จะตอบ 503 แทนการส่งผลจากรุ่นอื่น

เปิด `http://127.0.0.1:8000/models` เพื่อตรวจ `default_model` และ `available` ของแต่ละรุ่น

พารามิเตอร์ `b3_tta` ใช้กับทั้ง `/predict` และ `/compare`:

| ค่า | ผล |
|---|---|
| ไม่ระบุ | ใช้ `B3_TTA_OVERRIDE` ในโค้ด: `True` เปิด TTA หรือ `False` ใช้ภาพเดียว |
| `true` | ทดลอง TTA 6 แบบโดยตรง |
| `false` | ใช้ภาพเดียว |

ตัวอย่างคำขอ: `POST /predict?model_type=efficientnet_b3&b3_tta=true` หรือ `POST /compare?b3_tta=true` พร้อมไฟล์ฟิลด์ `image` ทดสอบผ่านหน้า `/docs` ได้ ส่วน `/models` มี `b3_inference.default_tta` ให้ตรวจโหมดเริ่มต้นของเว็บ

การเพิ่ม TTA อาจช่วยบางภาพและทำให้บางภาพผิด จึงมีทั้งค่าภาพรวม รายงานรายกลุ่ม และจำนวนภาพที่เปลี่ยนจากถูกเป็นผิด/ผิดเป็นถูกในขั้น 14.3 หากใช้ Test เดิมซ้ำเพื่อปรับตัวเลือก ต้องมีชุดภายนอกที่กันไว้เพิ่มเติมสำหรับยืนยันผลขั้นสุดท้าย

## การเรียนรู้เพิ่ม

### ประเมิน MobileNet และ EfficientNet-B0 เดิมใน Colab แยกกัน

Notebook เดิมมีส่วนเพิ่มสำหรับน้ำหนักที่ฝึกจาก VSCode โดยไม่ฝึกหรือบันทึกทับน้ำหนัก:

| งาน | MobileNetV3-Small | EfficientNet-B0 |
|---|---|---|
| ตั้งค่าและโหลด `.pth` | 20 | 30 |
| ประเมินชุด Train จาก checkpoint | 21 | 31 |
| Validation ภาพเดียว | 22 | 32 |
| Validation TTA 6 แบบ | 23 | 33 |
| Test ภาพเดียว + สรุปแบบภาพเดียว | 24 | 34 |
| Test TTA 6 แบบ + สรุปแบบ TTA | 25 | 35 |
| ทดลองอัปโหลดรูป | 26 | 36 |
| ส่งออก ZIP รายงานของโมเดลนั้น | 27 | 37 |

เริ่มจากขั้น **1 → 2** แล้วเลือก **20–27** หรือ **30–37** ได้โดยไม่ต้องรัน B3 หรืออีกโมเดลก่อน ให้วาง `mobilenet_model.pth` และ `efficientnet_model.pth` ในโฟลเดอร์ `dog_project` บน Drive คู่กับ ZIP และ `manifest_split.csv` หรือแก้ตัวแปร `MOBILENET_WEIGHTS_PATH` / `EFFICIENTNET_B0_WEIGHTS_PATH` ในขั้น 20/30 ให้ตรงพาธจริง

หากขั้น 20/30 แจ้ง `partially initialized module 'torch' ... library` แปลว่าล้มเหลวตอนนำเข้า PyTorch ก่อนอ่านน้ำหนัก ให้เลือก **Runtime → Restart session / Restart runtime** แล้วรัน **1 → 2 → 20** หรือ **1 → 2 → 30** ใหม่ หากยังผิด ให้ใช้ **Runtime → Disconnect and delete runtime** เพื่อเริ่มเครื่อง Colab ใหม่ตาม [Colab FAQ](https://research.google.com/colaboratory/faq.html) ไม่ต้อง Train ใหม่ ขั้น 1/20/30 มีการตรวจ import PyTorch/Torchvision ก่อนส่วนประเมิน และไม่ได้สั่งติดตั้งหรือเปลี่ยนรุ่น Torch อัตโนมัติ

ผลเก็บแยกใน `dog_project/evaluations/mobilenet_v3_small/<weights_sha>_<split_sha>/` และ `dog_project/evaluations/efficientnet_b0/<weights_sha>_<split_sha>/` แต่ละส่วนมีโมเดล ตัวแปร คำทำนาย แคช และ ZIP ของตัวเอง ไม่มี Ensemble และไม่ใช้ผล B3 แทน ทั้งสองใช้ Resize 224×224 และ Normalize ตาม API เดิม TTA ใช้ 6 แบบตาม B0 เดิม

**สิ่งที่รายงานได้จาก `.pth`:** Loss (NLL), Accuracy, Precision/Recall แบบ Macro, Macro F1, รายงาน 6 กลุ่ม, กราฟค่าภาพรวม/รายกลุ่ม และ Confusion Matrix ของชุด Train/Val/Test ที่เลือก ค่า Train เป็นการประเมินน้ำหนักคงที่หลังฝึก ไม่ใช่ค่าเฉลี่ยระหว่าง Epoch

**สิ่งที่ `.pth` ไม่มี:** รายการ Loss/Accuracy ย้อนหลังแต่ละ Epoch โค้ด VSCode เดิมใน `retrain_batch.py` และ `/learn` ไม่ได้บันทึก history.csv จึงไม่สร้างกราฟ Epoch ขึ้นมาเอง หากมีประวัติในอนาคต กำหนด `MOBILENET_HISTORY_PATH` / `EFFICIENTNET_B0_HISTORY_PATH` ได้ โดยไม่เอาประวัติ B3 หรือ Notebook เก่ามาปะปน

ข้อมูลแบ่งชุดเดิมของน้ำหนักสองไฟล์ยังไม่มีหลักฐานผูกกับ checkpoint นี้ รายงานจึงระบุว่าเป็นผลตาม manifest ปัจจุบัน และยังไม่ยืนยันว่า Test ไม่เคยถูกใช้ฝึก เพื่อยืนยัน split เดิมสามารถให้ metadata ที่ระบุ architecture, class_names, weights_sha256 และ dataset.split_sha256 ตรงกับไฟล์จริงได้ ภาพใน `learned_data` เป็นภาพที่เคยสอนโมเดล ไม่ใช่ Test อิสระ

ตัวช่วยอยู่ใน `model/saved_model_evaluation.py` และฝังโค้ดเดียวกันใน Colab ทดสอบแบบอ่านน้ำหนักจริงโดยไม่ฝึกได้ด้วย:

```powershell
python -m unittest discover -s model/tests -v
```

`/learn` และ `retrain_batch.py` ยังฝึกต่อเฉพาะ MobileNet และ B0 ตามโค้ดเดิม ไม่ฝึกทับ B3 ที่ประเมินแล้ว หากต้องการ B3 รุ่นใหม่ ให้ฝึกและประเมินแยกใน Colab แล้วอัปเดตทั้งน้ำหนักและ metadata ที่ผูกกับไฟล์ใหม่ การส่งภาพเข้า `/predict` ไม่ได้ปรับน้ำหนัก

## ขอบเขตการทดสอบการเชื่อมระบบ

การตรวจด้วยภาพจำลองยืนยันได้ว่าไฟล์โหลดครบ การเตรียมภาพ B3 ตรงกับ Torchvision/Colab การเฉลี่ยคะแนน TTA ตรงกันระหว่าง API กับ Notebook และ API เลือกผลกับส่ง JSON ได้ถูกต้อง แต่ไม่ได้เป็นการวัดความแม่นยำทางโรคผิวหนังใหม่

คะแนน Test ของ Run เดิมคือ Accuracy ประมาณ 94.79% บน 1,902 ภาพ โดยยังมีภาพที่ทายผิดทั้งที่คะแนนสูง ไม่ควรตีความคะแนน Softmax ของภาพหนึ่งภาพว่าเป็นการยืนยันโรค
