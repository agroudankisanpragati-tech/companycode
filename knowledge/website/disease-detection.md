---
id: website-disease-detection
domain: website
language: en
status: draft-verified-from-repository
source: frontend/src/app/disease-detection/page.tsx and frontend/src/components/disease; screenshot review
---

# Disease Detection

## Scan a crop

1. Sign in. If you are signed out, the page shows a login prompt and the scan button is disabled.
2. In **Crop & Language**, select or enter the crop to be scanned. Crop input supports typing or voice input; choose the input language if needed. The selected crop is the crop label sent with the image.
3. In **Upload Crop Photo**, choose a photo with the file picker, drag and drop it, or open the camera and capture a photo. The browser must grant camera permission; use an uploaded photo if camera access is denied.
4. Check the preview and the image quality indicator. The page marks images over 8 MB as too large and images under 0.05 MB as low quality. Use a clear, close photo of the affected plant; the indicator is a quality hint, not a diagnosis.
5. Select **Scan for Disease**. This requires both a selected crop and an image and requires sign-in. Wait for the scan to complete. If it reports an error, review the error shown on the page and retry when appropriate.
6. Review the result. Available controls include opening a report, providing helpful/not-helpful feedback, and **Scan Again**.

The scan form uses crop and language controls, an image upload/camera control, and a scan button. It does not ask the user to tick a checkbox in this flow.

## History and result limits

The page has separate scan/history tabs. Scan history is account-specific and paginated; the current page requests up to 20 records at a time. A displayed result may include disease name, crop, confidence, severity, causes, organic and chemical solution text, and prevention text. The page may also offer a language selector, report view, feedback, and scan-again action.

A scan result is a model/tool output, not a guaranteed diagnosis or a substitute for qualified local agricultural advice. Do not infer that the assistant independently examined the image. When a result is currently displayed, the page can send its displayed disease name, crop, confidence, severity, causes, solution text, and prevention text as live context. This is only the current result, not a general disease knowledge corpus; earlier history is not automatically the active result context.
