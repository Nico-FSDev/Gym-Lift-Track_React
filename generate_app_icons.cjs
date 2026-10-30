const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateIcons() {
  const possiblePaths = [
    path.join(__dirname, 'public/icon.png'),
    path.join(__dirname, 'public/Gym-Lift-Track_Icon.png'),
    path.join(process.cwd(), 'public/icon.png'),
    path.join(process.cwd(), 'public/Gym-Lift-Track_Icon.png'),
  ];

  let iconSource = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      iconSource = p;
      break;
    }
  }

  if (!iconSource) {
    console.error('Source icon not found in public/icon.png or public/Gym-Lift-Track_Icon.png');
    process.exit(1);
  }

  console.log(`Generating Android launcher icons from: ${iconSource}`);

  const densities = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108, fgIconSize: 72 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162, fgIconSize: 108 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216, fgIconSize: 144 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324, fgIconSize: 216 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432, fgIconSize: 288 },
  ];

  const resDir = path.join(process.cwd(), 'android/app/src/main/res');

  for (const density of densities) {
    const targetDir = path.join(resDir, density.name);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Standard square/adaptive ic_launcher.png
    await sharp(iconSource)
      .resize(density.iconSize, density.iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // 2. Round ic_launcher_round.png
    const circleSvg = Buffer.from(
      `<svg><circle cx="${density.iconSize / 2}" cy="${density.iconSize / 2}" r="${density.iconSize / 2}" fill="white"/></svg>`
    );
    await sharp(iconSource)
      .resize(density.iconSize, density.iconSize, { fit: 'cover' })
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // 3. Foreground ic_launcher_foreground.png (safe zone centered in 108dp canvas)
    const scaledFg = await sharp(iconSource)
      .resize(density.fgIconSize, density.fgIconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const padding = Math.round((density.fgSize - density.fgIconSize) / 2);

    await sharp({
      create: {
        width: density.fgSize,
        height: density.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: scaledFg, top: padding, left: padding }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${density.name}`);
  }

  // Ensure color resource exists for ic_launcher_background
  const valuesDir = path.join(resDir, 'values');
  if (!fs.existsSync(valuesDir)) {
    fs.mkdirSync(valuesDir, { recursive: true });
  }
  const colorXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
  fs.writeFileSync(
    colorXmlPath,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#111827</color>\n</resources>\n'
  );
  console.log('Saved values/ic_launcher_background.xml');

  console.log('Successfully generated all Android launcher icons!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
