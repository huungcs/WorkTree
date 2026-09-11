# Generate OG Image for WorkTree X (1200x630)
Add-Type -AssemblyName System.Drawing

$width = 1200
$height = 630
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# 1. Background dark gradient (#0a0f1d -> #12192b -> #191f36)
$bgRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point 0, 0),
    (New-Object System.Drawing.Point $width, $height),
    [System.Drawing.ColorTranslator]::FromHtml("#0b1120"),
    [System.Drawing.ColorTranslator]::FromHtml("#161d31")
)
$g.FillRectangle($bgBrush, $bgRect)
$bgBrush.Dispose()

# Ambient glow top-right
$glowBrush1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 105, 98, 219))
$g.FillEllipse($glowBrush1, 750, -120, 600, 600)
$glowBrush1.Dispose()

# Ambient glow bottom-left
$glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 115, 214, 180))
$g.FillEllipse($glowBrush2, -160, 260, 520, 520)
$glowBrush2.Dispose()

# Subtle tech grid pattern
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
for ($x = 40; $x -lt $width; $x += 48) {
    for ($y = 40; $y -lt $height; $y += 48) {
        $g.FillEllipse($dotBrush, $x, $y, 2, 2)
    }
}
$dotBrush.Dispose()

# Helper for rounded rectangles
function Draw-RoundedRectangle($graphics, $brush, $pen, $rect, $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    if ($brush) { $graphics.FillPath($brush, $path) }
    if ($pen) { $graphics.DrawPath($pen, $path) }
    $path.Dispose()
}

# 2. Top Badge: "ENTERPRISE CLOUD WORKSPACE"
$badgeRect = New-Object System.Drawing.Rectangle 80, 70, 320, 36
$badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 105, 98, 219))
$badgePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#6962db"), 1.2)
Draw-RoundedRectangle $g $badgeBrush $badgePen $badgeRect 18
$badgeBrush.Dispose()
$badgePen.Dispose()

$badgeDot = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#73d6b4"))
$g.FillEllipse($badgeDot, 98, 83, 10, 10)
$badgeDot.Dispose()

$badgeFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$badgeTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#c5bfec"))
$g.DrawString("ENTERPRISE CLOUD WORKSPACE", $badgeFont, $badgeTextBrush, 116, 79)
$badgeFont.Dispose()
$badgeTextBrush.Dispose()

# 3. Main Brand Title: "WorkTree X"
$titleFont = New-Object System.Drawing.Font("Segoe UI", 56, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#ffffff"))
$g.DrawString("WorkTree", $titleFont, $titleBrush, 75, 122)
$titleFont.Dispose()
$titleBrush.Dispose()

$xFont = New-Object System.Drawing.Font("Segoe UI", 56, [System.Drawing.FontStyle]::Bold)
$xBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#8d82f1"))
$g.DrawString("X", $xFont, $xBrush, 435, 122)
$xFont.Dispose()
$xBrush.Dispose()

# 4. Vietnamese Subtitle (Bound to 620px width)
$subFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#e2e8f5"))
$subRect = New-Object System.Drawing.RectangleF 80, 222, 620, 80
$subText = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes("Nền tảng điều hành công việc & Quản trị doanh nghiệp"))
$g.DrawString($subText, $subFont, $subBrush, $subRect)
$subFont.Dispose()
$subBrush.Dispose()

# Description line
$descFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Regular)
$descBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#8c9bb5"))
$descRect = New-Object System.Drawing.RectangleF 80, 295, 620, 50
$descText = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes("Không gian cộng tác trực quan • Cây tổ chức ma trận • Thông báo tức thì"))
$g.DrawString($descText, $descFont, $descBrush, $descRect)
$descFont.Dispose()
$descBrush.Dispose()

# 5. Feature Pills (Two neat rows)
$row1 = @("Cây tổ chức đa tầng", "Phân quyền theo Scope")
$row2 = @("Kanban & Lịch tiến độ", "Realtime & Push Noti")

$tagFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Regular)

function Draw-TagRow($items, $startX, $startY) {
    $curX = $startX
    foreach ($item in $items) {
        $text = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes($item))
        $size = $g.MeasureString($text, $tagFont)
        $w = [int]$size.Width + 28
        $h = 38
        
        $tRect = New-Object System.Drawing.Rectangle $curX, $startY, $w, $h
        $tBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(35, 255, 255, 255))
        $tBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), 1)
        Draw-RoundedRectangle $g $tBg $tBorder $tRect 10
        $tBg.Dispose()
        $tBorder.Dispose()
        
        # small check/bullet dot
        $dot = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#73d6b4"))
        $g.FillEllipse($dot, ($curX + 12), ($startY + 15), 6, 6)
        $dot.Dispose()
        
        $tb = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#e2e8f5"))
        $g.DrawString($text, $tagFont, $tb, ($curX + 24), ($startY + 9))
        $tb.Dispose()
        
        $curX += $w + 14
    }
}

Draw-TagRow $row1 80 365
Draw-TagRow $row2 80 415
$tagFont.Dispose()

# 6. Bottom Domain Brand Bar
$urlIconPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#73d6b4"), 1.5)
$g.DrawEllipse($urlIconPen, 82, 517, 14, 14)
$g.DrawLine($urlIconPen, 82, 524, 96, 524)
$urlIconPen.Dispose()

$urlFont = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$urlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#73d6b4"))
$g.DrawString("worktree.nguyentronghuu.com", $urlFont, $urlBrush, 105, 514)
$urlFont.Dispose()
$urlBrush.Dispose()

# 7. Right Side App Card Frame
$iconPath = Join-Path $PSScriptRoot "..\assets\icon-512.png"
if (Test-Path $iconPath) {
    $iconImg = [System.Drawing.Image]::FromFile($iconPath)
    
    # Outer card frame
    $cardRect = New-Object System.Drawing.Rectangle 770, 85, 350, 455
    $cardBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 20, 28, 46))
    $cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 105, 98, 219), 1.5)
    Draw-RoundedRectangle $g $cardBg $cardPen $cardRect 24
    $cardBg.Dispose()
    $cardPen.Dispose()
    
    # Logo inside
    $logoSize = 240
    $logoX = 770 + (350 - $logoSize) / 2
    $logoY = 125
    $g.DrawImage($iconImg, $logoX, $logoY, $logoSize, $logoSize)
    
    # Card Brand Title
    $cardLabelFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $cardLabelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#ffffff"))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("WorkTree X Cloud", $cardLabelFont, $cardLabelBrush, (770 + 175), 395, $sf)
    $cardLabelFont.Dispose()
    $cardLabelBrush.Dispose()
    
    # Card Subtitle
    $subCardText = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::UTF8.GetBytes("Bảo mật • Đa tổ chức • Realtime"))
    $cardSubFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
    $cardSubBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#a0acc4"))
    $g.DrawString($subCardText, $cardSubFont, $cardSubBrush, (770 + 175), 430, $sf)
    $cardSubFont.Dispose()
    $cardSubBrush.Dispose()
    
    $sf.Dispose()
    $iconImg.Dispose()
}

# Save output
$outPath = Join-Path $PSScriptRoot "..\assets\og-image.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Output "Generated: $outPath"
