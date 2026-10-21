import os
import uuid
import logging
import requests
from PIL import Image
from config import Config

logger = logging.getLogger("market_linkage")

def enhance_product_image(input_image_path: str, output_folder: str = None, backdrop_style: str = "warm_studio") -> dict:
    """
    Enhances an artisan product photo by separating the foreground craft
    and placing it onto a professional e-commerce studio background (solid warm-white or pure white).
    Preserves 100% of authentic craft details, shape, colors, handles, and textures.
    
    If REMOVE_BG_API_KEY is configured, uses Remove.bg genuine segmentation.
    If the image already has an alpha transparency channel (transparent PNG/WEBP), composites cleanly.
    If no genuine background-removal service is configured, does NOT introduce artificial blur;
    it preserves the original photo at full resolution without blur artifacts.
    """
    if not output_folder:
        output_folder = Config.PRODUCT_UPLOAD_FOLDER
    os.makedirs(output_folder, exist_ok=True)
    
    if not input_image_path or not os.path.exists(input_image_path):
        return {
            "success": False,
            "error": "Input image file does not exist."
        }
        
    filename_base = f"enhanced_{uuid.uuid4().hex[:10]}"
    output_filename = f"{filename_base}.jpg"
    output_path = os.path.join(output_folder, output_filename)
    
    # 1. Cloud background removal service (Remove.bg)
    remove_bg_key = os.getenv("REMOVE_BG_API_KEY", "")
    if remove_bg_key:
        try:
            cloud_result = _call_remove_bg_api(input_image_path, remove_bg_key, output_path, backdrop_style)
            if cloud_result.get("success"):
                return {
                    "success": True,
                    "service_available": True,
                    "service_used": "remove_bg_cloud_api",
                    "enhanced_filename": output_filename,
                    "enhanced_image_url": f"/api/products/images/{output_filename}",
                    "backdrop_style": backdrop_style,
                    "craft_fidelity": "Authentic product contours, handles, and textures preserved without blur",
                    "disclaimer": "Processed via Remove.bg with clean solid studio backdrop."
                }
        except Exception as e:
            logger.warning(f"Cloud background removal API failed: {e}")

    # 2. Check if image has native alpha channel (e.g. transparent PNG or WEBP)
    try:
        with Image.open(input_image_path) as img:
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                alpha = img.convert("RGBA").split()[3]
                # Check if there are actual transparent pixels (alpha < 250)
                extrema = alpha.getextrema()
                if extrema[0] < 200:
                    # Clean solid composite with zero blur
                    bg_color = (250, 248, 245) if backdrop_style == "warm_studio" else (255, 255, 255)
                    composite = Image.new("RGB", img.size, bg_color)
                    composite.paste(img.convert("RGBA"), mask=alpha)
                    composite.save(output_path, "JPEG", quality=95)
                    return {
                        "success": True,
                        "service_available": True,
                        "service_used": "alpha_channel_clean_composite",
                        "enhanced_filename": output_filename,
                        "enhanced_image_url": f"/api/products/images/{output_filename}",
                        "backdrop_style": backdrop_style,
                        "craft_fidelity": "Clean foreground composite with authentic edges",
                        "disclaimer": "Foreground placed cleanly onto solid studio backdrop without blur."
                    }
    except Exception as e:
        logger.warning(f"Could not inspect native image alpha: {e}")

    # 3. No genuine background removal service is configured:
    # Strictly avoid artificial blur, cloudy patches, or smeared edges!
    # Preserve original photo at full resolution without blur artifacts.
    return {
        "success": False,
        "service_available": False,
        "enhanced_filename": None,
        "enhanced_image_url": None,
        "message": "Background removal service is not configured (REMOVE_BG_API_KEY not set). Original photograph is preserved at 100% full resolution without artificial blur artifacts."
    }

def _call_remove_bg_api(input_path: str, api_key: str, output_path: str, backdrop_style: str = "warm_studio") -> dict:
    url = "https://api.remove.bg/v1.0/removebg"
    bg_color = "FAF8F5" if backdrop_style == "warm_studio" else "FFFFFF"
    with open(input_path, "rb") as img_file:
        response = requests.post(
            url,
            files={"image_file": img_file},
            data={"size": "auto", "bg_color": bg_color},
            headers={"X-Api-Key": api_key},
            timeout=15
        )
    if response.status_code == 200:
        with open(output_path, "wb") as out_file:
            out_file.write(response.content)
        return {"success": True}
    else:
        raise Exception(f"Remove.bg returned {response.status_code}: {response.text}")
