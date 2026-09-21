export const aiService = {
  async verifySticker(base64Image) {
    try {
      const cleanBase64 = base64Image.includes('base64,') 
        ? base64Image.split('base64,')[1] 
        : base64Image;

      const response = await fetch('/roboflow-api/jappy-q7ej5/workflows/lspu-gate-sticker-verification-1789985279940', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_ROBOFLOW_API_KEY}`
        },
        body: JSON.stringify({
          inputs: {
            "image": { "type": "base64", "value": cleanBase64 }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Roboflow API error: ${response.status}`);
      }

      const result = await response.json();
      console.log("RAW ROBOFLOW JSON:", result);
      
      // THE FIX: Dig into the nested array where Roboflow hides the data
      const aiData = result.outputs && result.outputs.length > 0 ? result.outputs[0] : {};
      
      return {
        success: true,
        isDetected: aiData.sticker_detected, 
        count: aiData.sticker_count,
        predictions: aiData.predictions, 
        annotatedImage: aiData.output_image
      };

    } catch (error) {
      console.error("AI Verification Failed:", error);
      return { success: false, error: error.message };
    }
  }
};