import sys
sys.path.insert(0, '.')
from playwright.sync_api import sync_playwright
from collect_standards import search_bis_keyword, wait_for_bis

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    candidates = search_bis_keyword(page, 'ordinary portland cement', limit=5)
    target = next((c for c in candidates if '269:2015' in c['is_number']), None)
    if target:
        url = target['detail_url']
        page.goto(url, wait_until='networkidle')
        wait_for_bis(page)
        
        # Click Standards Referred tab
        try:
            tab = page.locator('div.mat-mdc-tab-labels div.mdc-tab').filter(has_text="Standards Referred")
            tab.click(timeout=5000)
            page.wait_for_timeout(2000)
            print("Clicked Standards Referred")
        except Exception as e:
            print("Failed to click refs tab:", e)
            
        text_refs = page.locator('body').inner_text()
        
        # Click Amendment tab
        try:
            tab = page.locator('div.mat-mdc-tab-labels div.mdc-tab').filter(has_text="Amendment")
            tab.click(timeout=5000)
            page.wait_for_timeout(2000)
            print("Clicked Amendment")
        except Exception as e:
            print("Failed to click amend tab:", e)
            
        text_amend = page.locator('body').inner_text()
        
        with open('bis_tabs_text.txt', 'w', encoding='utf-8') as f:
            f.write("=== REFS TAB ===\n")
            f.write(text_refs)
            f.write("\n\n=== AMEND TAB ===\n")
            f.write(text_amend)
            
    browser.close()
