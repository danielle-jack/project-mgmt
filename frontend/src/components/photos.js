import { createContext } from 'react'

/**
 * Profile photos by user id (a Map of id -> image data URL), filled in by App from the
 * loaded users. Avatar reads it, so any avatar given a userId shows the photo.
 */
export const PhotosContext = createContext(new Map())

/**
 * Turns a picked image file into a small square JPEG data URL (about 10 KB), cropped
 * from the middle, so photos stay light enough to store in the database.
 */
export function resizePhoto(file, size = 128) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file (JPEG, PNG…).'))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image couldn’t be read. Try a different file.')) }
    img.src = url
  })
}
