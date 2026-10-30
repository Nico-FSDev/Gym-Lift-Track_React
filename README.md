# Gym Lift Track 🏋️‍♂️

> **Next-generation strength training and bodybuilding tracker featuring real-time biomechanical muscle fatigue decay, interactive anatomical mapping, 3D physique visualization, and machine stack calibration.**

---

## ⚡ Quick Summary (GitHub Repo Description)

**Short Description for GitHub About section:**
> *High-performance strength & bodybuilding log featuring interactive 3D/2D anatomical muscle fatigue mapping, exponential recovery decay, machine baseline stack calibration, and cross-platform PWA/Capacitor support.*

**Recommended GitHub Topics:**
`fitness-tracker` `bodybuilding` `biomechanics` `muscle-fatigue` `threejs` `react19` `vite` `tailwindcss` `pwa` `capacitor` `firebase` `strength-training` `workout-log`

---

## ✨ Key Features

### 🧬 Real-Time Muscle Fatigue & Biomechanical Recovery
- **Exponential Recovery Decay**: Uses a continuous 48-hour half-life exponential decay model to accurately reflect systemic and muscular recovery over time.
- **Interactive Anatomical Muscle Avatar**: Dynamic SVG anatomical model highlighting 20+ individual muscles and 7 major muscle groups (Chest, Back, Shoulders, Arms, Legs, Glutes, Core).
- **Unilateral Directional Fatigue**: Unilateral oblique and core tracking sensitive to rotation angles (e.g., Rotary Torso directional degree tracking).
- **Recovery-Based Smart Sorting**: Instant "Sort by Fatigue" switch ordering exercises from 100% fresh (0% fatigue) to exhausted to optimize workout splits.

### 🦾 Equipment Calibration & Machine Stack Offsets
- **Multi-Equipment Classifications**: Full support for Selectorized Machines, Plate-Loaded Machines, Free Weights (Barbell/Dumbbell), and Calisthenics/Bodyweight.
- **Axis & Stack Base Weights**: Dynamic stack offset calibration (e.g., `+X lbs/kg` for bar, axis friction, or bodyweight baselines) with weight-inversion support.
- **Brand & Muscle Linking**: Custom equipment creation with custom brand tags and specific muscle target mapping.

### 🧍 3D Physique & Gains Visualizer
- **Three.js & CSG 3D Rendering**: Procedural 3D body shape and bodybuilding visualizer illustrating hypertrophy progression and muscle volume over time.
- **Gain Profile & Proportion Metrics**: Visual representation of volume distribution across muscle groups.

### ⏱️ Workout Logging & Rest Management
- **Integrated Rest Timers**: Floating and card-integrated countdown timers with progress rings based on exercise-specific rest intervals.
- **Daily Volume & Sets Counter**: Real-time counter of sets logged today directly on each machine card.
- **Precision Inputs**: Circular degree wheel pickers for angle-based exercises, flexible rep counters, and weight modifiers.

### 📊 Analytics & Nutrition
- **Progression Charts**: Interactive volume, rep max, and frequency visualizations powered by Recharts.
- **Calorie & Macro Calculator**: Integrated energy expenditure and nutrition guidance tailored to training intensity.
- **Workout History & CSV Export/Import**: Full backup, import, and data portability.

### 📱 Modern Full-Stack & Mobile Architecture
- **PWA & Offline Capable**: Instant install on iOS/Android via Service Workers and offline caching.
- **Capacitor Android Native**: Packaged for Android with native Google Authentication and app lifecycle handling.
- **Cloud Persistence**: Firebase Firestore real-time sync with role-based access control, subscription/credit management, and Stripe integration.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Motion (Framer Motion) |
| **3D & Visuals** | Three.js, Three-CSG-TS, glTF Transform, Recharts, Lucide Icons |
| **Backend & API** | Node.js, Express, tsx, esbuild, Google Gemini API |
| **Data & Auth** | Firebase Authentication, Cloud Firestore, Stripe |
| **Mobile & Native** | Capacitor 8 (Android/iOS), Vite PWA, Workbox |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ or v20+ recommended)
- npm or pnpm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/gym-lift-track.git
   cd gym-lift-track
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory (refer to `.env.example` if available):
   ```env
   # Firebase Web Config
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for Production:**
   ```bash
   npm run build
   npm start
   ```

---

## 📱 Mobile Native Build (Capacitor)

```bash
# Sync web build assets with Capacitor
npx cap copy
npx cap sync

# Open Android Studio
npx cap open android
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
