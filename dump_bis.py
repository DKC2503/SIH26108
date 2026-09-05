import sys
from playwright.sync_api import sync_playwright

url = "https://standards.bis.gov.in/website/standard-details?encryptedId=eyJpdiI6Ikg1MlVsWXEwUWVxY28rWXpQS0hPeGc9PSIsInZhbHVlIjoiT0hiRzBiaUlSWE1Tc0dNOHBDODVodz09IiwibWFjIjoiZDMzZjRmM2FiMzg0YWU2YTFjNjc3NWVkYzk5YjQyYTBjMWExZWQyMjIyNjkzMzI3ZTRlODM0NmY0NzY5OTUwYSIsInRhZyI6IiJ9&standardNumber=IS%20269:2015"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(url, wait_until="networkidle")
    text = page.locator("body").inner_text()
    
    with open("bis_is_269_text.txt", "w", encoding="utf-8") as f:
        f.write(text)
        
    html = page.content()
    with open("bis_is_269_html.txt", "w", encoding="utf-8") as f:
        f.write(html)
        
    browser.close()
