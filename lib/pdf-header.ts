import jsPDF from 'jspdf'
import { getCompanySettings } from './settings'

/**
 * Adds company header to PDF documents
 * - Company logo in upper left corner (constant size: 20mm x 20mm)
 * - Company name, address, email, and telephone centered below
 */
export async function addCompanyHeaderToPDF(pdf: jsPDF, startY: number = 20): Promise<number> {
  try {
    const settings = await getCompanySettings()
    let currentY = startY
    const logoSize = 20 // Constant size in mm
    const logoX = 20 // Upper left corner
    const logoY = currentY

    // Load and add company logo (if available)
    if (settings.company_logo_url) {
      try {
        const logoImg = await loadImage(settings.company_logo_url)
        // Resize logo to constant size while maintaining aspect ratio
        const logoAspectRatio = logoImg.width / logoImg.height
        let logoWidth = logoSize
        let logoHeight = logoSize
        
        if (logoAspectRatio > 1) {
          // Wider than tall
          logoHeight = logoSize / logoAspectRatio
        } else {
          // Taller than wide
          logoWidth = logoSize * logoAspectRatio
        }
        
        // Detect image format from URL or use default
        const imageFormat = detectImageFormat(settings.company_logo_url || '')
        pdf.addImage(logoImg.src, imageFormat, logoX, logoY, logoWidth, logoHeight)
        currentY = Math.max(currentY, logoY + logoHeight + 3)
      } catch (error) {
        console.error('Error loading company logo:', error)
        // Continue without logo
      }
    }

    // Company name and details (centered)
    const centerX = 105 // Center of A4 page (210mm / 2)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(24)
    pdf.text(settings.company_name, centerX, currentY, { align: 'center' })
    currentY += 8

    // Address
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    if (settings.company_address) {
      pdf.text(settings.company_address, centerX, currentY, { align: 'center' })
      currentY += 6
    }

    // Telephone
    if (settings.company_telephone) {
      pdf.text(`Tel: ${settings.company_telephone}`, centerX, currentY, { align: 'center' })
      currentY += 6
    }

    // Email
    if (settings.company_email) {
      pdf.text(`Email : ${settings.company_email}`, centerX, currentY, { align: 'center' })
      currentY += 6
    }

    // Line separator
    pdf.setDrawColor(0, 0, 0)
    pdf.line(20, currentY, 190, currentY)
    currentY += 5

    return currentY
  } catch (error) {
    console.error('Error adding company header:', error)
    // Fallback to default header
    const centerX = 105
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(24)
    pdf.text('R.S.Enterprises', centerX, startY, { align: 'center' })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text('No.164/B,Nittambuwa Road,Paththalagedara,Veyangoda', centerX, startY + 8, { align: 'center' })
    pdf.text('Tel: 0773073156,0332245886', centerX, startY + 14, { align: 'center' })
    pdf.text('Email : rsenterprises59@gmail.com', centerX, startY + 20, { align: 'center' })
    pdf.setDrawColor(0, 0, 0)
    pdf.line(20, startY + 25, 190, startY + 25)
    return startY + 30
  }
}

/**
 * Helper function to load image from URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (error) => reject(error)
    img.src = src
  })
}

/**
 * Detect image format from URL or data URL
 */
function detectImageFormat(url: string): string {
  if (url.startsWith('data:')) {
    const match = url.match(/data:image\/(\w+);/)
    if (match) {
      const format = match[1].toUpperCase()
      return format === 'JPEG' ? 'JPEG' : format
    }
  } else {
    const ext = url.split('.').pop()?.toLowerCase()
    if (ext === 'jpg' || ext === 'jpeg') return 'JPEG'
    if (ext === 'png') return 'PNG'
    if (ext === 'gif') return 'GIF'
  }
  return 'PNG' // Default
}
