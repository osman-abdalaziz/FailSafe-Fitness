# AI_DIRECTIVES.md - MetricFit Project Constitution

### Part 1: Advanced Mechanical Training Tracking Unit (Hevy Clone Architecture)

**1.1 Routine Management & Strict Isolation**

- **Independent Routine Scope:** Routines act as isolated templates. Progression data (last weight/reps) is strictly scoped to the specific routine. (e.g., A 10kg/12rep Bench Press in 'Routine A' will not overwrite the 12kg/8rep history of the same exercise in 'Routine B').
- **Full Customization:** Users can dynamically add, remove, reorder, or swap exercises within a routine. Routine names and metadata are fully editable.
- **Social Sharing:** Routines can be shared via links/IDs, allowing other users to import the exact template into their own "My Routines" directory.

**1.2 Custom Exercise Engine**

- **Database Augmentation:** If an exercise is missing from the global catalog, users can create custom exercises.
- **Rich Metadata:** Custom exercises support adding titles, instructional images/videos, target muscle groups, and required equipment.
- **Global User Scope:** Once a custom exercise is created within a routine, it gets saved to the user's personal exercise database and becomes available for all future routines. Fully editable post-creation.

**1.3 Live Session Protocol (Active Workout)**

- **Session Initiation:** Sessions can be initiated from a pre-built routine or as a "Blank Workout" (adding exercises on the fly, with an option to save as a new routine upon completion).
- **Persistent State:** An active session is never accidentally lost. It runs a continuous background timer. The session only ends via explicit user action: `Finish` (saves to log), `Discard` (deletes data), or `Resume` (returns to active session).
- **Rest Timer & Auto-Fill Mechanics:**
    - Clicking the 'Check' icon on a set marks it complete (green) and automatically triggers the predefined rest timer for that exercise.
    - **Ghost Auto-Fill:** If the user clicks the 'Check' icon without manually typing a weight or rep count, the system automatically adopts the values from the transparent placeholder (the previous session's exact data for that routine) and saves them as the actual input.

**1.4 Volumetric Logging & PR Engine**

- **Dual-Layer Logging:** \* _General Log:_ Tracks all historical occurrences of an exercise.
    - _Routine-Specific Log:_ Feeds the 'Ghost Placeholders' for the next session of that exact routine.
- **Volume Calculation:** Automatically computes `Total Volume = Weight x Reps` in real-time during the active session.
- **New Record (PR) Logic:** PRs are calculated strictly based on Set Volume. If historical Set 1 was 10kg x 12 (Volume 120), and today Set 1 is 10kg x 15 (Volume 150), it triggers a UI "New Record" indicator. PRs are only updated if the new Volume strictly exceeds the historical max volume for that specific exercise.

**1.5 Directory & Folder Organization**

- **Categorization:** Users can create custom folders (e.g., "Brother's Plan", "Client X") using a toggle-list UI.
- **Drag-and-Drop:** Routines can be moved between folders seamlessly.
- **Default Directory:** A permanent, un-deletable, and un-renamable "My Routines" folder exists as the root directory for all imported or unsorted routines.

**1.6 Edge Cases & Mechanical Rules**

- **Set Classifications:** Users must specify Set Types (Warm-up, Normal, Drop-set, Failure). _Rule:_ Warm-up sets are strictly excluded from Total Volume and PR calculations.
- **Bodyweight (BW) Protocol:** For BW exercises (e.g., Pull-ups), the system allows logging "Added Weight". PRs prioritize added weight first, then rep maxes.
- **Unilateral Tagging:** Exercises can be tagged as "Unilateral" (e.g., Dumbbell Curls) to ensure volume tracking is contextually accurate.
- **Live Exercise Swapping:** Users can replace an exercise mid-session (e.g., if a machine is taken) without disrupting the session timer or losing prior set data.
- **Offline-First Architecture:** Active sessions are continuously cached to `LocalStorage`. If `Finish` is clicked without an internet connection, the log is saved locally and synced to Firebase automatically once the connection is restored.

### Part 2: Dynamic Nutrition Router & Clinical Macro Tracking

**2.1 Precision BMR & Goal Initialization**

- **Deep Calculation Engine:** Upon first launch, the system requests extensive biometric data to calculate the exact Baseline Metabolic Rate (BMR) and Total Daily Energy Expenditure (TDEE). Inputs include weight, height, physical activity level, age, body fat percentage, and anatomical circumferences (waist, thigh).
- **Target Mapping:** Users select their primary clinical goal (Maintenance, Deficit/Weight Loss, Surplus/Weight Gain). The system applies the appropriate mathematical modifiers to establish the baseline nutritional targets.

**2.2 Comprehensive Database & Saved Recipes**

- **Global Integration:** Connected to a massive open database (e.g., Open Food Facts) for accurate barcode scanning and nutritional fact retrieval.
- **Meal Templating:** Features a "Save as Recipe" or "Quick Add" function for frequently consumed meals (e.g., daily breakfast) to bypass the AI processing and save time.

**2.3 Tri-Channel Daily Logging (Strict Day Isolation)**

- Each day acts as an isolated logging environment. Meals can be logged via three distinct channels:
    - **Method A (Traditional):** Manual search bar queries or Barcode scanning for precise, verified entry.
    - **Method B (Smart NLP):** Users type a natural language string (e.g., "8 flat tablespoons of rice and half a boiled chicken breast"). Sent to Gemini API, returning a structured JSON payload of ingredients and macros.
    - **Method C (AI Vision + Worst-Case Protocol):** Users upload a photo of the meal with a reference object (e.g., a coin or fork) for spatial scaling. _Crucial Rule:_ The AI is programmed to assume the "Worst-Case Scenario" for restaurant/unknown meals (e.g., automatically adding 10g of hidden cooking oil to grilled meats) to protect the deficit.
- **Editable UI Table:** Regardless of the entry method, the output generates an editable breakdown: Meal Title, Total Macros/Calories, and a granular ingredient list. Users can manually adjust individual component weights before final commit.

**2.4 Dynamic Calorie Routing & Hard Caps**

- **The Banking System (Rollover):** If a user under-eats (e.g., consumes 1500 kcal out of a 2000 kcal target), the remaining 500 kcal is "banked." This credit rolls over, allowing for high-calorie days (e.g., 3000 kcal) later in the week while mathematically maintaining the weekly deficit.
- **Deficit Correction (Borrowing):** If a user overeats (e.g., 2500 kcal out of 2000), the system dynamically recalculates the targets for the subsequent days (e.g., dropping the next two days to 1750 kcal) to repair the weekly average.
- **The Protein Red Line:** Dynamic adjustments ONLY subtract from Carbohydrates and Fats. The daily Protein target is strictly immutable to prevent muscle catabolism.
- **Clinical Hard Cap:** The algorithm enforces a strict safety threshold (e.g., targets cannot dynamically drop below 60% of the calculated BMR). If the required deficit violates this cap, the adjustment is spread over a longer duration.
- **Static Expenditure Target:** Active calories burned via exercise are strictly ignored. The nutritional target remains static to prevent inaccurate fitness tracker estimations from destroying the caloric deficit.

**2.5 Proactive Interventions (AI Counseling & Radar)**

- **Morning-After Protocol:** If the Dynamic Router enforces a severe deficit due to prior overeating, the AI triggers a morning notification providing advanced clinical satiety strategies (e.g., volume eating, timing) to help the user survive the day without a hunger-induced relapse.
- **Micronutrient Radar:** AI JSON responses specifically parse and track Dietary Fiber and Electrolytes (Potassium/Sodium). Severe deficiencies trigger immediate clinical warnings to protect gastrointestinal function and CNS efficiency.

### Part 3: Advanced Progress Tracking & Visual Analytics

**3.1 Comprehensive Progress Dashboard**

- **Visual Data Representation:** A dedicated analytics page rendering dynamic charts and graphs to visualize user progression over time.
- **Weekly Report Module:** An on-demand, non-mandatory input form allowing users to log weekly biometric data. Metrics are categorized into Core (e.g., Total Weight, Waist) and Optional (e.g., Chest, Arms, Thighs) to feed the visual charts without restricting app functionality if skipped.

**3.2 Standardized Biometric Photography**

- **4-Angle Capture System:** Dedicated interface to capture and log physique photos from four standardized profiles: Front, Back, Left, and Right.
- **Ghost-Overlay Camera:** To guarantee structural consistency for visual comparisons, the camera viewfinder displays the corresponding photo from the previous week as a translucent overlay. This enforces exact alignment, distance, and angle for every shot.
- **Client-Side Compression:** To maintain extremely low storage costs and high retrieval speeds, all photos undergo aggressive client-side compression. Images are algorithmically resized and converted to lightweight `WebP` format (e.g., max 800x800px) directly within the browser before Firebase upload.

**3.3 Advanced Comparative Analysis Engine**

- **Dual-Date Selection:** Users can pick any two historical entries (e.g., Week 1 vs. Week 12) from the database to run a direct comparative audit.
- **Metric Comparison View:** Renders a side-by-side numerical and graphical breakdown showing the exact delta (increase/decrease) in all logged body measurements and weight between the two selected dates.
- **Interactive Before/After Slider:** A highly responsive UI component for historical photos. The user can drag a vertical slider left and right over perfectly aligned images from the two selected dates, providing a seamless and accurate visual inspection of physical changes.

### Part 4: The AI Clinical Brain (Gemini Integration)

**4.1 Trigger-Based AI Architecture**

- To prevent alert fatigue, API bloat, and useless generic motivational text, the AI operates strictly on an "Exception & Trigger" model. It only intervenes when the underlying logic detects an anomaly (e.g., performance regression, severe caloric overshoot, or a plateau).

**4.2 Post-Workout Clinical Analysis (Performance Regression)**

- **The Trigger:** The algorithm detects a downward trend in training volume, paired with a logged deficit in sleep hours or daily nutrition.
- **The Action:** The AI generates a highly realistic, strictly actionable post-workout diagnostic report. It cross-references the current session with historical data and recovery metrics to diagnose the performance drop, providing precise adjustments for the next session. No fluff permitted.

**4.3 Biomechanical Spaced Repetition (Injury Prevention)**

- Users can log biomechanical notes or pain symptoms (e.g., "front delt pain at the bottom of the movement") directly after completing an exercise.
- The AI processes the symptom biomechanically and extracts a precise "Corrective Motor Cue."
- **Delivery:** This cue is stored and displayed as a mandatory UI intercept screen immediately before the user starts the _exact same exercise_ in their next session, ensuring form correction at the most critical moment.

**4.4 Nutritional Audit & Caloric Crisis Management**

- **Crisis Intervention:** If a user drastically overshoots their caloric target (e.g., consuming 3500 kcal on a 2000 kcal target), the AI acts as a clinical counselor. It provides a scientifically backed physiological protocol to handle the surplus, managing the dynamic deficit routing (from Part 2) without causing a psychological binge-eating relapse.
- **Periodic Nutritional Audit:** A bi-weekly automated AI scan of the user's logged meals. The AI analyzes sugar intake, empty calories, and nutrient gaps, providing a medical-grade report to optimize food quality and micronutrient density.

**4.5 Plateau Prediction Engine**

- **The Trigger:** The mathematical algorithm detects a flattening of the weight and mandatory waist measurement curves over a 14-day period.
- **The Action:** The AI analyzes the stall to differentiate between metabolic adaptation and NEAT (Non-Exercise Activity Thermogenesis) reduction. It prescribes a specific clinical adjustment, such as a calculated carbohydrate reduction or a specific daily step increase.

**4.6 BYOK (Bring Your Own Key) Infrastructure**

- The AI core strictly utilizes the user's personal Gemini API key stored locally in the browser. This ensures a 100% free, serverless, and sovereign ecosystem with zero recurring subscription costs or external server dependencies.

### Part 5: Technology Stack & System Architecture (Zero-Budget Ecosystem)

**5.1 Core Frontend Engine**

- **HTML5 & CSS3:** Pure, semantic markup. Fully responsive design (Mobile-first, adapting seamlessly to desktop/tablets).
- **Custom CSS Framework:** Built entirely from scratch utilizing CSS Variables (`:root`). This ensures a lightweight, ultra-fast UI and avoids the bloatware associated with external frameworks (e.g., Bootstrap or Tailwind).
- **Vanilla JavaScript (ES6+):** The entire "brain" of the application, state management, UI routing, and AI data prep will be built using pure JavaScript. No heavy JS frameworks (React/Vue/Angular) to guarantee zero latency.

**5.2 Backend & Cloud Infrastructure (Firebase)**

- **Database:** Firebase Firestore (NoSQL) for real-time syncing and offline data caching.
- **Cloud Logic:** Firebase Cloud Functions utilizing **Node.js** (JavaScript) instead of Python. This establishes a unified Full-Stack JavaScript ecosystem, allowing algorithmic reuse between the client and server.
- **Hosting:** Firebase Hosting for fast, secure, and free global delivery.

**5.3 Progressive Web App (PWA) Standards**

- Strict integration of `manifest.json` and Service Workers. This allows the website to be installed directly to the mobile home screen as a native-feeling app, and enables crucial offline capabilities (e.g., logging a workout in a gym with no internet).

**5.4 Zero-Cost Libraries & Assets**

- **Chart.js:** A lightweight, open-source library for rendering interactive volume, weight, and biometric analytics charts.
- **Font Awesome & Google Material Symbols:** Free-tier icon libraries utilized for a clean, clinical, and universally understood UI design.

**5.5 Native Browser APIs (Zero-Dependency Solutions)**

- **Client-Side Image Compression:** Utilizing the native `HTML5 Canvas API` to programmatically compress 4-angle progress photos and convert them to lightweight `WebP` formats locally on the user's device _before_ uploading to Firebase. This drastically reduces bandwidth and storage costs.

### Part 6: Database Architecture (The MetricFit Hybrid Schema)

**6.1 User Profile & Clinical State**

- `users/{uid}/profile`: Static biometric data (Age, Height, Activity Level, Body Fat %, Circumferences).
- `users/{uid}/clinical_targets`: Calculated baseline (BMR, TDEE, Safety Hard Cap).
- `users/{uid}/dynamic_state`: Runtime anchor only.
    - `protein_target`: Immutable daily anchor.
    - `last_calculated_at`: Timestamp for cache validation.
    - _Rule:_ Banked/Borrowed calories are derived at runtime from `nutrition_log` to ensure data integrity.

**6.2 Mechanical Exercise Catalog**

- `exercises/{exercise_id}`: Global/Custom exercise metadata (Name, Muscle Group, Equipment, `is_unilateral`, `is_bodyweight`).

**6.3 User Exercise State (The Performance Layer)**

- `user_exercise_state/{uid_exerciseId}`: **(One document per exercise per user)**.
    - _Fields:_ `best_volume`, `last_used_weight`, `last_reps`, `biomechanical_cue`, `last_pain_note`.
    - _Purpose:_ Powers the Ghost Auto-Fill, PR tracking, and AI cue injection with a single document read.

**6.4 Routine Templates (Embedded Architecture)**

- `routines/{routine_id}`:
    - `routine_metadata`: Name, Folder, UID.
    - `exercises_array`: An array of exercise objects containing `exercise_id`, `order`, and `rest_timer_seconds`.
    - _Rule:_ Exercises are embedded as an array to minimize Firestore reads to 1 per routine.

**6.5 Volumetric Training Logs (Embedded Architecture)**

- `workouts_log/{workout_id}`:
    - `metadata`: `start_time`, `end_time`, `status`, `routine_id`.
    - `exercises_data`: A nested array of objects. Each object contains `exercise_id` and a sub-array of `sets`.
    - `sets_array`: Contains `{set_type, weight, reps, volume, is_pr}`.
    - _Rule:_ Entire workout session is 1 document. This ensures maximum speed and zero cost. Warm-up sets are tagged and excluded from volume logic.

**6.6 Nutrition & Micronutrient Router (Embedded Architecture)**

- `nutrition_log/{date_id}`: Indexed by `YYYY-MM-DD`.
    - `daily_totals`: Aggregated Macros, Fiber, Potassium, and Sodium.
    - `meals_array`: An array of meal objects.
    - `ingredients`: Nested array within each meal.
    - _Rule:_ All meals and ingredients for the day are stored in 1 document. Banking/Borrowing is computed by aggregating these daily documents.

**6.7 Progress Audits & Visual Media**

- `progress_audits/{audit_id}`:
    - `metrics`: Mandatory (Weight, Waist) and Optional (Chest, Arms, Thighs).
    - `photo_refs`: Firebase Storage URLs for Front, Back, Left, and Right views.
    - _Storage Rule:_ Photos are compressed client-side to WebP format (max 800x800px) before upload to `/progress/{uid}/{date}/`.

### Part 7: AI Development Rules & Operational Protocol

**7.1 GitHub First Rule (Mandatory)**

- The AI MUST request the GitHub repository link before generating or modifying any code. No work shall commence without reviewing the latest commit to ensure environment synchronization.

**7.2 Non-Destructive Development**

- We build, we do not destroy. Once a feature or logic is approved, the AI is strictly forbidden from reverting, deleting, or refactoring it unless explicitly requested by the Project Manager or if a critical architectural conflict is identified.

**7.3 Surgical Code Modification Protocol**

- When modifying existing code, the AI shall not provide entire files unless necessary. Instead, it must provide the specific code snippet with precise comments (`// NEW CONTENT HERE` or `// MODIFIED LINE`) explaining exactly where and what to change. This ensures the Project Manager maintains full manual control over the codebase.

**7.4 Preservation of User Contributions**

- The AI is strictly prohibited from removing or overwriting any logic, comments, or structures manually added or edited by the Project Manager.

**7.5 Continuous Context Sync**

- After every major step or implementation, the `AI_DIRECTIVES.md` file MUST be updated to reflect the "Current State." This ensures 100% context preservation regardless of session duration or breaks.

**7.6 Strict English-Only UI & Codebase**

- The application's UI, HTML markup, CSS variables, JavaScript logic, comments, and database schema MUST be written entirely in English. No Arabic text is allowed within the source code or the user interface.

---

### Current Project State: GROUND ZERO (Phase 0)

- **Status:** All previous boilerplate `index.html` and `style.css` have been purged.
- **Current Objective:** Awaiting the Project Manager's return from exams to initiate the first "Real Commit."
- **Next Action:** Build the Core App Shell (PWA) from absolute scratch based on the final Hybrid Schema.

### Current Project State: Phase 2.1 (UI Framework Integration)

- **Status:** Core CSS Variables (`style.css`), Zero-Inline-Styles HTML framework (`framework.html`), and initial JavaScript UX interactions (`ui-components.js`) have been established.
- **Key Features Built:** - Custom LTR English PWA Design System.
    - Advanced `Style 1` (Vertical arrows) & `Style 2` (Central +/-) Number Inputs with Long-Press auto-fire mechanics.
- **Next Action:** Awaiting further UX/UI modifications from the Project Manager or moving to specific page routing (Workout/Nutrition screens).
