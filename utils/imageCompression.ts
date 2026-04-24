export const compressImage = (input: File | string, maxSize = 150, quality = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const handleImageLoad = (dataUrl: string) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };

    if (typeof input === 'string') {
      handleImageLoad(input);
    } else {
      const reader = new FileReader();
      reader.readAsDataURL(input);
      reader.onload = (event) => {
        handleImageLoad(event.target?.result as string);
      };
      reader.onerror = (err) => reject(err);
    }
  });
};
