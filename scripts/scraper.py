import urllib.request
import json
import ssl
import os
from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_result_content = False
        self.result_content_level = 0
        self.in_item = False
        self.div_level = 0
        self.item_div_level = 0
        self.current_item = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            self.div_level += 1
            for attr in attrs:
                if attr[0] == "class":
                    classes = attr[1].split()
                    if "result_content" in classes:
                        self.in_result_content = True
                        self.result_content_level = self.div_level
                    if self.in_result_content and "item" in classes:
                        self.in_item = True
                        self.item_div_level = self.div_level
                        self.current_item = []
        if tag == "img" and self.in_item:
            for attr in attrs:
                if attr[0] == "src" and not attr[1].startswith("images/template"):
                    # Prepend base URL for images
                    self.current_item.append(f"IMG:http://202.29.173.190/textbook/web/{attr[1]}")

    def handle_endtag(self, tag):
        if tag == "div":
            if self.in_item and self.div_level == self.item_div_level:
                self.in_item = False
                self.items.append(self.current_item)
            if self.in_result_content and self.div_level == self.result_content_level:
                self.in_result_content = False
            self.div_level -= 1

    def handle_data(self, data):
        data = data.strip()
        if self.in_item and data:
            self.current_item.append(data)

def extract_item(texts):
    if len(texts) < 2:
        return {}
    
    # Check if image was captured
    img_url = ""
    clean_texts = []
    for t in texts:
        if t.startswith("IMG:"):
            img_url = t.replace("IMG:", "")
        else:
            clean_texts.append(t)
            
    if len(clean_texts) < 2:
        return {}

    book_type = clean_texts[0]
    book_name = clean_texts[1]
    
    item_dict = {
        "ประเภท": book_type,
        "ชื่อหนังสือ": book_name,
        "รายวิชา": "",
        "กลุ่มสาระการเรียนรู้": "",
        "ชั้น": "",
        "ผู้จัดพิมพ์": "",
        "ผู้เรียบเรียง": "",
        "ปีพิมพ์เผยแพร่": "",
        "ขนาด": "",
        "จำนวนหน้า": "",
        "กระดาษ": "",
        "พิมพ์": "",
        "น้ำหนัก": "",
        "ราคา": "",
        "รูปภาพ": img_url
    }
    
    labels = ["รายวิชา", "กลุ่มสาระการเรียนรู้", "ชั้น", "ผู้จัดพิมพ์", "ผู้เรียบเรียง", "ปี พ.ศ. ที่เผยแพร่", "ขนาด", "จำนวนหน้า", "กระดาษ", "พิมพ์", "น้ำหนัก"]
    
    # Process attributes
    for i in range(len(clean_texts)):
        txt = clean_texts[i]
        if txt == "ปี พ.ศ. ที่เผยแพร่" and i + 1 < len(clean_texts):
            item_dict["ปีพิมพ์เผยแพร่"] = clean_texts[i+1]
        elif txt in labels and i + 1 < len(clean_texts):
            item_dict[txt] = clean_texts[i+1]
        elif txt.startswith("ราคา "):
            item_dict["ราคา"] = txt.replace("ราคา ", "")
            
    return item_dict

def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # Include bookmain 11,12,21,22,31,32 per user's request
    base_url = "http://202.29.173.190/textbook/web/index.php?bookmain=11%2C12%2C21%2C22%2C31%2C32&bookgroup=&class=&bookprint=&bookcategory=&name=&bookeditor=&id_round=&chksearch=true&ispage="
    
    all_books = []
    page = 1
    
    while True:
        url = base_url + str(page)
        print(f"Fetching page {page}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            response = urllib.request.urlopen(req, context=ctx)
            html = response.read().decode('utf-8', errors='replace')
            
            parser = MyHTMLParser()
            parser.feed(html)
            
            if not parser.items:
                print(f"No items found on page {page}. Stopping.")
                break
                
            for texts in parser.items:
                book_data = extract_item(texts)
                if book_data:
                    all_books.append(book_data)
                    
            print(f"Page {page} fetched {len(parser.items)} items.")
            page += 1
            
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

    print(f"Finished fetching. Total books: {len(all_books)}")
    
    if all_books:
        # Save to the root of the project
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        filename = os.path.join(project_dir, "data.json")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(all_books, f, ensure_ascii=False, indent=2)
        print(f"Saved to {filename}")

if __name__ == "__main__":
    main()
