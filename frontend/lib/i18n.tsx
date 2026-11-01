"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "am" | "ar";

const translations: Record<Language, Record<string, string>> = {
  en: {
    Language: "Language",
    English: "English",
    Amharic: "Amharic",
    Arabic: "Arabic",
    "መረጃAI home": "መረጃAI home",
    "መረጃAI": "መረጃAI",
    "Switch to light theme": "Switch to light theme",
    "Switch to dark theme": "Switch to dark theme",
    "Bring your sources together, ask better questions, and explore answers grounded in your research.": "Bring your sources together, ask better questions, and explore answers grounded in your research.",
    Ask: "Ask",
    "Create account": "Create account",
    "Welcome back": "Welcome back",
    "Sign in to continue your research.": "Sign in to continue your research.",
    Email: "Email",
    Password: "Password",
    "Signing in…": "Signing in…",
    "Sign in": "Sign in",
    "New here?": "New here?",
    "Create an account": "Create an account",
    "Could not sign in. Check that the backend is running.": "Could not sign in. Check that the backend is running.",
    "Create your account": "Create your account",
    "Display name": "Display name",
    "Use at least 8 characters.": "Use at least 8 characters.",
    "Confirm password": "Confirm password",
    "Passwords do not match.": "Passwords do not match.",
    "Creating account…": "Creating account…",
    "Already registered?": "Already registered?",
    "Could not create your account.": "Could not create your account.",
    "Password recovery unavailable": "Password recovery unavailable",
    "Email-based password recovery is not configured in this MVP. Contact the workspace operator for account help.": "Email-based password recovery is not configured in this MVP. Contact the workspace operator for account help.",
    "Return to sign in": "Return to sign in",
    "Finishing Google sign-in…": "Finishing Google sign-in…",
    "Google sign-in could not be completed.": "Google sign-in could not be completed.",
    "Try again": "Try again",
    Dismiss: "Dismiss",
    "Your question": "Your question",
    "Ask a question…": "Ask a question…",
    "Could not get an answer. Check that the backend is running and try again.": "Could not get an answer. Check that the backend is running and try again.",
    Thinking: "Thinking",
    "What would you like to know?": "What would you like to know?",
    "Ask a general question to start. Sign in to chat with answers grounded in your own documents and webpages.": "Ask a general question to start. Sign in to chat with answers grounded in your own documents and webpages.",
    "New guest chat": "New guest chat",
    "My research": "My research",
    "Your library": "Your library",
    "Prepare your sources": "Prepare your sources",
    "Add documents or public webpages, then continue to a chat grounded in your sources.": "Add documents or public webpages, then continue to a chat grounded in your sources.",
    "Open chat": "Open chat",
    Collections: "Collections",
    "sources": "sources",
    Rename: "Rename",
    Delete: "Delete",
    Save: "Save",
    Cancel: "Cancel",
    "New collection": "New collection",
    Add: "Add",
    Sources: "Sources",
    "Create a collection to add sources.": "Create a collection to add sources.",
    "Upload PDF, DOCX, TXT, or Markdown": "Upload PDF, DOCX, TXT, or Markdown",
    "Working…": "Working…",
    "Upload file": "Upload file",
    "Add public web URL(s)": "Add public web URL(s)",
    "Add URL(s)": "Add URL(s)",
    Remove: "Remove",
    passages: "passages",
    file: "file",
    url: "webpage",
    queued: "queued",
    processing: "processing",
    indexed: "indexed",
    "partially indexed": "partially indexed",
    failed: "failed",
    deleted: "deleted",
    "Sources you add will appear here with their indexing status.": "Sources you add will appear here with their indexing status.",
    "Retry": "Retry",
    "Back to collections": "Back to collections",
    "New chat": "New chat",
    "Chat history": "Chat history",
    "Research scope": "Research scope",
    "Research assistant": "Research assistant",
    "Ask a question grounded in your sources": "Ask a question grounded in your sources",
    "Add and index documents or public pages, select one or more collections, and ask for a summary, comparison, or specific detail. Answers include inspectable source passages.": "Add and index documents or public pages, select one or more collections, and ask for a summary, comparison, or specific detail. Answers include inspectable source passages.",
    You: "You",
    "Research answer": "Research answer",
    "Searching sources and preparing a cited answer…": "Searching sources and preparing a cited answer…",
    "Source ingestion is running in the background. New passages become searchable when indexed.": "Source ingestion is running in the background. New passages become searchable when indexed.",
    "Edit your question…": "Edit your question…",
    "Ask a research question…": "Ask a research question…",
    Researching: "Researching",
    "Editing a question will replace it and regenerate the answer.": "Editing a question will replace it and regenerate the answer.",
    "Cancel edit": "Cancel edit",
    Evidence: "Evidence",
    "Your account": "Your account",
    "Sign out": "Sign out",
    "Open profile menu": "Open profile menu",
    "New collection name": "New collection name",
    "Include {name} in research": "Include {name} in research",
    "Rename {name}": "Rename {name}",
    "Delete {name}": "Delete {name}",
    "Remove {name}": "Remove {name}",
    "Rename conversation": "Rename conversation",
    "Delete conversation": "Delete conversation",
    "New title for {name}": "New title for {name}",
    "Copy message": "Copy message",
    Copied: "Copied",
    Copy: "Copy",
    "Edit and regenerate this message": "Edit and regenerate this message",
    "Edit message": "Edit message",
    "Loading your research workspace…": "Loading your research workspace…",
    "Could not load the research workspace.": "Could not load the research workspace.",
    "Could not load sources.": "Could not load sources.",
    "Could not refresh source status.": "Could not refresh source status.",
    "Could not create the collection.": "Could not create the collection.",
    "Could not rename the collection.": "Could not rename the collection.",
    "Could not delete the collection.": "Could not delete the collection.",
    'Delete "{name}" and all of its sources?': 'Delete "{name}" and all of its sources?',
    'Remove "{name}" from this collection?': 'Remove "{name}" from this collection?',
    "Could not upload this file.": "Could not upload this file.",
    "Could not add these URLs.": "Could not add these URLs.",
    "Could not retry ingestion.": "Could not retry ingestion.",
    "Could not remove this source.": "Could not remove this source.",
    "Could not copy this message.": "Could not copy this message.",
    "Could not copy this message: {error}": "Could not copy this message: {error}",
    "Could not start a new conversation.": "Could not start a new conversation.",
    'Delete "{name}"?': 'Delete "{name}"?',
    "Could not delete the conversation.": "Could not delete the conversation.",
    "Could not rename this conversation.": "Could not rename this conversation.",
    "Could not load this conversation.": "Could not load this conversation.",
    "Could not complete the research request.": "Could not complete the research request.",
    "Select at least one collection to search.": "Select at least one collection to search.",
    "Research question": "Research question",
    "Evidence cited in this answer": "Evidence cited in this answer",
    "Page {number}": "Page {number}",
    "Message copied": "Message copied",
  },
  am: {
    Language: "ቋንቋ",
    English: "English",
    Amharic: "አማርኛ",
    Arabic: "العربية",
    "መረጃAI home": "መነሻ ገጽ - መረጃAI",
    "መረጃAI": "መረጃAI",
    "Switch to light theme": "ወደ ብርሃን ገጽታ ቀይር",
    "Switch to dark theme": "ወደ ጨለማ ገጽታ ቀይር",
    "Bring your sources together, ask better questions, and explore answers grounded in your research.": "ምንጮችዎን በአንድ ላይ ያሰባስቡ፣ የተሻሉ ጥያቄዎችን ይጠይቁ፣ እና በምርምርዎ ላይ የተመሰረቱ መልሶችን ያግኙ።",
    Ask: "ጠይቅ",
    "Create account": "መለያ ፍጠር",
    "Welcome back": "እንኳን ደህና መጡ",
    "Sign in to continue your research.": "ምርምርዎን ለመቀጠል ይግቡ።",
    Email: "ኢሜይል",
    Password: "የይለፍ ቃል",
    "Signing in…": "በመግባት ላይ…",
    "Sign in": "ግባ",
    "New here?": "አዲስ ነዎት?",
    "Create an account": "መለያ ይፍጠሩ",
    "Could not sign in. Check that the backend is running.": "መግባት አልተቻለም። የጀርባ አገልጋዩ እየሰራ መሆኑን ያረጋግጡ።",
    "Create your account": "መለያዎን ይፍጠሩ",
    "Display name": "የሚታይ ስም",
    "Use at least 8 characters.": "ቢያንስ 8 ቁምፊዎችን ይጠቀሙ።",
    "Confirm password": "የይለፍ ቃሉን ያረጋግጡ",
    "Passwords do not match.": "የይለፍ ቃሎቹ አይዛመዱም።",
    "Creating account…": "መለያ በመፍጠር ላይ…",
    "Already registered?": "አስቀድመው ተመዝግበዋል?",
    "Could not create your account.": "መለያዎን መፍጠር አልተቻለም።",
    "Password recovery unavailable": "የይለፍ ቃል መመለሻ አይገኝም",
    "Email-based password recovery is not configured in this MVP. Contact the workspace operator for account help.": "በኢሜይል የይለፍ ቃል መመለስ አልተዋቀረም። ለመለያ እገዛ የስራ ቦታውን አስተዳዳሪ ያግኙ።",
    "Return to sign in": "ወደ መግቢያ ይመለሱ",
    "Finishing Google sign-in…": "የGoogle መግቢያ በማጠናቀቅ ላይ…",
    "Google sign-in could not be completed.": "በGoogle መግባትን ማጠናቀቅ አልተቻለም።",
    "Try again": "እንደገና ይሞክሩ",
    Dismiss: "ዝጋ",
    "Your question": "ጥያቄዎ",
    "Ask a question…": "ጥያቄ ይጠይቁ…",
    "What would you like to know?": "ምን ማወቅ ይፈልጋሉ?",
    "Could not get an answer. Check that the backend is running and try again.": "መልስ ማግኘት አልተቻለም። የጀርባ አገልጋዩን ያረጋግጡና እንደገና ይሞክሩ።",
    Thinking: "በማሰብ ላይ",
    "Ask a general question to start. Sign in to chat with answers grounded in your own documents and webpages.": "ለመጀመር አጠቃላይ ጥያቄ ይጠይቁ። በራስዎ ሰነዶችና ድረ-ገጾች ላይ የተመሰረቱ መልሶችን ለማግኘት ይግቡ።",
    "New guest chat": "አዲስ የእንግዳ ውይይት",
    "My research": "የእኔ ምርምር",
    "Your library": "የእርስዎ ቤተ-መጻሕፍት",
    "Prepare your sources": "ምንጮችዎን ያዘጋጁ",
    "Add documents or public webpages, then continue to a chat grounded in your sources.": "ሰነዶችን ወይም ይፋዊ ድረ-ገጾችን ያክሉ፣ ከዚያ በምንጮችዎ ላይ ወደተመሰረተ ውይይት ይቀጥሉ።",
    "Open chat": "ውይይት ክፈት",
    Collections: "ስብስቦች",
    sources: "ምንጮች",
    Rename: "እንደገና ሰይም",
    Delete: "ሰርዝ",
    Save: "አስቀምጥ",
    Cancel: "ይቅር",
    "New collection": "አዲስ ስብስብ",
    Add: "አክል",
    Sources: "ምንጮች",
    "Create a collection to add sources.": "ምንጮችን ለመጨመር ስብስብ ይፍጠሩ።",
    "Upload PDF, DOCX, TXT, or Markdown": "PDF፣ DOCX፣ TXT ወይም Markdown ይጫኑ",
    "Working…": "በመስራት ላይ…",
    "Upload file": "ፋይል ጫን",
    "Add public web URL(s)": "የይፋዊ ድረ-ገጽ አድራሻ(ዎች) አክል",
    "Add URL(s)": "የድረ-ገጽ አድራሻ(ዎች) አክል",
    Remove: "አስወግድ",
    passages: "ክፍሎች",
    file: "ፋይል",
    url: "ድረ-ገጽ",
    queued: "በወረፋ ላይ",
    processing: "በሂደት ላይ",
    indexed: "ወደ ማውጫ ገብቷል",
    "partially indexed": "በከፊል ወደ ማውጫ ገብቷል",
    failed: "አልተሳካም",
    deleted: "ተሰርዟል",
    "Sources you add will appear here with their indexing status.": "የጨመሯቸው ምንጮች ከማውጫ ሁኔታቸው ጋር እዚህ ይታያሉ።",
    Retry: "እንደገና ሞክር",
    "Back to collections": "ወደ ስብስቦች ተመለስ",
    "New chat": "አዲስ ውይይት",
    "Chat history": "የውይይት ታሪክ",
    "Research scope": "የምርምር ወሰን",
    "Research assistant": "የምርምር ረዳት",
    "Ask a question grounded in your sources": "በምንጮችዎ ላይ የተመሰረተ ጥያቄ ይጠይቁ",
    "Add and index documents or public pages, select one or more collections, and ask for a summary, comparison, or specific detail. Answers include inspectable source passages.": "ሰነዶችን ወይም ይፋዊ ገጾችን ያክሉና ወደ ማውጫ ያስገቡ። ስብስቦችን ይምረጡና ማጠቃለያ፣ ንጽጽር ወይም ዝርዝር ይጠይቁ። መልሶች ሊመረመሩ የሚችሉ የምንጭ ክፍሎችን ያካትታሉ።",
    You: "እርስዎ",
    "Research answer": "የምርምር መልስ",
    "Searching sources and preparing a cited answer…": "ምንጮችን በመፈለግ ላይ፣ ማጣቀሻ ያለው መልስ በማዘጋጀት ላይ…",
    "Source ingestion is running in the background. New passages become searchable when indexed.": "ምንጮች ከበስተጀርባ እየተዘጋጁ ነው። ወደ ማውጫ ከገቡ በኋላ መፈለግ ይቻላል።",
    "Edit your question…": "ጥያቄዎን ያርትዑ…",
    "Ask a research question…": "የምርምር ጥያቄ ይጠይቁ…",
    Researching: "በምርምር ላይ",
    "Editing a question will replace it and regenerate the answer.": "ጥያቄን ማርትዕ ያለውን ጥያቄ በመተካት መልሱን እንደገና ያመነጫል።",
    "Cancel edit": "ማርትዕ ተወው",
    Evidence: "ማስረጃ",
    "Your account": "መለያዎ",
    "Sign out": "ውጣ",
    "Open profile menu": "የመገለጫ ምናሌ ክፈት",
    "New collection name": "የአዲስ ስብስብ ስም",
    "Include {name} in research": "{name}ን በምርምር ውስጥ አካትት",
    "Rename {name}": "{name}ን እንደገና ሰይም",
    "Delete {name}": "{name}ን ሰርዝ",
    "Remove {name}": "{name}ን አስወግድ",
    "Rename conversation": "ውይይትን እንደገና ሰይም",
    "Delete conversation": "ውይይትን ሰርዝ",
    "New title for {name}": "ለ{name} አዲስ ርዕስ",
    "Copy message": "መልዕክት ቅዳ",
    "Message copied": "መልዕክቱ ተቀድቷል",
    Copied: "ተቀድቷል",
    Copy: "ቅዳ",
    "Edit and regenerate this message": "ይህን መልዕክት አርትዕና መልሱን እንደገና አመንጭ",
    "Edit message": "መልዕክት አርትዕ",
    "Loading your research workspace…": "የምርምር ቦታዎን በመጫን ላይ…",
    "Could not load the research workspace.": "የምርምር ቦታውን መጫን አልተቻለም።",
    "Could not load sources.": "ምንጮችን መጫን አልተቻለም።",
    "Could not refresh source status.": "የምንጮችን ሁኔታ ማደስ አልተቻለም።",
    "Could not create the collection.": "ስብስቡን መፍጠር አልተቻለም።",
    "Could not rename the collection.": "ስብስቡን እንደገና መሰየም አልተቻለም።",
    "Could not delete the collection.": "ስብስቡን መሰረዝ አልተቻለም።",
    'Delete "{name}" and all of its sources?': '"{name}"ንና ሁሉንም ምንጮቹን ይሰርዙ?',
    'Remove "{name}" from this collection?': '"{name}"ን ከዚህ ስብስብ ያስወግዱ?',
    "Could not upload this file.": "ይህን ፋይል መጫን አልተቻለም።",
    "Could not add these URLs.": "እነዚህን አድራሻዎች ማከል አልተቻለም።",
    "Could not retry ingestion.": "ምንጩን እንደገና ማዘጋጀት አልተቻለም።",
    "Could not remove this source.": "ይህን ምንጭ ማስወገድ አልተቻለም።",
    "Could not copy this message.": "ይህን መልዕክት መቅዳት አልተቻለም።",
    "Could not copy this message: {error}": "ይህን መልዕክት መቅዳት አልተቻለም፦ {error}",
    "Could not start a new conversation.": "አዲስ ውይይት መጀመር አልተቻለም።",
    'Delete "{name}"?': '"{name}"ን ይሰርዙ?',
    "Could not delete the conversation.": "ውይይቱን መሰረዝ አልተቻለም።",
    "Could not rename this conversation.": "ይህን ውይይት እንደገና መሰየም አልተቻለም።",
    "Could not load this conversation.": "ይህን ውይይት መጫን አልተቻለም።",
    "Could not complete the research request.": "የምርምር ጥያቄውን ማጠናቀቅ አልተቻለም።",
    "Select at least one collection to search.": "ለመፈለግ ቢያንስ አንድ ስብስብ ይምረጡ።",
    "Research question": "የምርምር ጥያቄ",
    "Evidence cited in this answer": "በዚህ መልስ የተጠቀሱ ማስረጃዎች",
    "Page {number}": "ገጽ {number}",
  },
  ar: {
    Language: "اللغة",
    English: "English",
    Amharic: "الأمهرية",
    Arabic: "العربية",
    "መረጃAI home": "الصفحة الرئيسية - መረጃAI",
    "መረጃAI": "መረጃAI",
    "Switch to light theme": "التبديل إلى الوضع الفاتح",
    "Switch to dark theme": "التبديل إلى الوضع الداكن",
    "Bring your sources together, ask better questions, and explore answers grounded in your research.": "اجمع مصادرك، واطرح أسئلة أفضل، واستكشف إجابات مستندة إلى بحثك.",
    Ask: "اسأل",
    "Create account": "إنشاء حساب",
    "Welcome back": "مرحبًا بعودتك",
    "Sign in to continue your research.": "سجّل الدخول لمتابعة بحثك.",
    Email: "البريد الإلكتروني",
    Password: "كلمة المرور",
    "Signing in…": "جارٍ تسجيل الدخول…",
    "Sign in": "تسجيل الدخول",
    "New here?": "مستخدم جديد؟",
    "Create an account": "إنشاء حساب",
    "Could not sign in. Check that the backend is running.": "تعذّر تسجيل الدخول. تحقق من تشغيل الخادم الخلفي.",
    "Create your account": "أنشئ حسابك",
    "Display name": "الاسم المعروض",
    "Use at least 8 characters.": "استخدم 8 أحرف على الأقل.",
    "Confirm password": "تأكيد كلمة المرور",
    "Passwords do not match.": "كلمتا المرور غير متطابقتين.",
    "Creating account…": "جارٍ إنشاء الحساب…",
    "Already registered?": "لديك حساب بالفعل؟",
    "Could not create your account.": "تعذّر إنشاء حسابك.",
    "Password recovery unavailable": "استعادة كلمة المرور غير متاحة",
    "Email-based password recovery is not configured in this MVP. Contact the workspace operator for account help.": "لم يتم إعداد استعادة كلمة المرور عبر البريد الإلكتروني. تواصل مع مسؤول مساحة العمل للمساعدة.",
    "Return to sign in": "العودة إلى تسجيل الدخول",
    "Finishing Google sign-in…": "جارٍ إكمال تسجيل الدخول عبر Google…",
    "Google sign-in could not be completed.": "تعذّر إكمال تسجيل الدخول عبر Google.",
    "Try again": "أعد المحاولة",
    Dismiss: "إغلاق",
    "Your question": "سؤالك",
    "Ask a question…": "اطرح سؤالًا…",
    "What would you like to know?": "ما الذي تريد معرفته؟",
    "Could not get an answer. Check that the backend is running and try again.": "تعذّر الحصول على إجابة. تحقق من تشغيل الخادم الخلفي ثم أعد المحاولة.",
    Thinking: "جارٍ التفكير",
    "Ask a general question to start. Sign in to chat with answers grounded in your own documents and webpages.": "اطرح سؤالًا عامًا للبدء. سجّل الدخول للحصول على إجابات مستندة إلى مستنداتك وصفحات الويب الخاصة بك.",
    "New guest chat": "محادثة جديدة",
    "My research": "بحثي",
    "Your library": "مكتبتك",
    "Prepare your sources": "جهّز مصادرك",
    "Add documents or public webpages, then continue to a chat grounded in your sources.": "أضف مستندات أو صفحات ويب عامة، ثم تابع إلى محادثة تستند إلى مصادرك.",
    "Open chat": "افتح المحادثة",
    Collections: "المجموعات",
    sources: "مصادر",
    Rename: "إعادة تسمية",
    Delete: "حذف",
    Save: "حفظ",
    Cancel: "إلغاء",
    "New collection": "مجموعة جديدة",
    Add: "إضافة",
    Sources: "المصادر",
    "Create a collection to add sources.": "أنشئ مجموعة لإضافة المصادر.",
    "Upload PDF, DOCX, TXT, or Markdown": "ارفع ملف PDF أو DOCX أو TXT أو Markdown",
    "Working…": "جارٍ العمل…",
    "Upload file": "رفع ملف",
    "Add public web URL(s)": "إضافة رابط أو روابط عامة",
    "Add URL(s)": "إضافة رابط أو روابط",
    Remove: "إزالة",
    passages: "مقاطع",
    file: "ملف",
    url: "صفحة ويب",
    queued: "في قائمة الانتظار",
    processing: "قيد المعالجة",
    indexed: "تمت الفهرسة",
    "partially indexed": "تمت فهرسته جزئيًا",
    failed: "فشل",
    deleted: "محذوف",
    "Sources you add will appear here with their indexing status.": "ستظهر المصادر التي تضيفها هنا مع حالة الفهرسة.",
    Retry: "إعادة المحاولة",
    "Back to collections": "العودة إلى المجموعات",
    "New chat": "محادثة جديدة",
    "Chat history": "سجل المحادثات",
    "Research scope": "نطاق البحث",
    "Research assistant": "مساعد البحث",
    "Ask a question grounded in your sources": "اطرح سؤالًا مستندًا إلى مصادرك",
    "Add and index documents or public pages, select one or more collections, and ask for a summary, comparison, or specific detail. Answers include inspectable source passages.": "أضف المستندات أو الصفحات العامة وافهرسها، واختر مجموعة أو أكثر، ثم اطلب ملخصًا أو مقارنة أو تفاصيل محددة. تتضمن الإجابات مقتطفات قابلة للفحص من المصادر.",
    You: "أنت",
    "Research answer": "إجابة البحث",
    "Searching sources and preparing a cited answer…": "جارٍ البحث في المصادر وإعداد إجابة موثقة…",
    "Source ingestion is running in the background. New passages become searchable when indexed.": "تُعالج المصادر في الخلفية. ستصبح المقاطع قابلة للبحث بعد فهرستها.",
    "Edit your question…": "عدّل سؤالك…",
    "Ask a research question…": "اطرح سؤالًا بحثيًا…",
    Researching: "جارٍ البحث",
    "Editing a question will replace it and regenerate the answer.": "سيؤدي تعديل السؤال إلى استبداله وإنشاء إجابة جديدة.",
    "Cancel edit": "إلغاء التعديل",
    Evidence: "الأدلة",
    "Your account": "حسابك",
    "Sign out": "تسجيل الخروج",
    "Open profile menu": "افتح قائمة الملف الشخصي",
    "New collection name": "اسم المجموعة الجديدة",
    "Include {name} in research": "ضمّ {name} إلى البحث",
    "Rename {name}": "إعادة تسمية {name}",
    "Delete {name}": "حذف {name}",
    "Remove {name}": "إزالة {name}",
    "Rename conversation": "إعادة تسمية المحادثة",
    "Delete conversation": "حذف المحادثة",
    "New title for {name}": "عنوان جديد لـ{name}",
    "Copy message": "نسخ الرسالة",
    "Message copied": "تم نسخ الرسالة",
    Copied: "تم النسخ",
    Copy: "نسخ",
    "Edit and regenerate this message": "تعديل هذه الرسالة وإنشاء إجابة جديدة",
    "Edit message": "تعديل الرسالة",
    "Loading your research workspace…": "جارٍ تحميل مساحة البحث…",
    "Could not load the research workspace.": "تعذّر تحميل مساحة البحث.",
    "Could not load sources.": "تعذّر تحميل المصادر.",
    "Could not refresh source status.": "تعذّر تحديث حالة المصدر.",
    "Could not create the collection.": "تعذّر إنشاء المجموعة.",
    "Could not rename the collection.": "تعذّرت إعادة تسمية المجموعة.",
    "Could not delete the collection.": "تعذّر حذف المجموعة.",
    'Delete "{name}" and all of its sources?': 'هل تريد حذف "{name}" وجميع مصادرها؟',
    'Remove "{name}" from this collection?': 'هل تريد إزالة "{name}" من هذه المجموعة؟',
    "Could not upload this file.": "تعذّر رفع هذا الملف.",
    "Could not add these URLs.": "تعذّرت إضافة هذه الروابط.",
    "Could not retry ingestion.": "تعذّرت إعادة معالجة المصدر.",
    "Could not remove this source.": "تعذّرت إزالة هذا المصدر.",
    "Could not copy this message.": "تعذّر نسخ هذه الرسالة.",
    "Could not copy this message: {error}": "تعذّر نسخ هذه الرسالة: {error}",
    "Could not start a new conversation.": "تعذّر بدء محادثة جديدة.",
    'Delete "{name}"?': 'هل تريد حذف "{name}"؟',
    "Could not delete the conversation.": "تعذّر حذف المحادثة.",
    "Could not rename this conversation.": "تعذّرت إعادة تسمية هذه المحادثة.",
    "Could not load this conversation.": "تعذّر تحميل هذه المحادثة.",
    "Could not complete the research request.": "تعذّر إكمال طلب البحث.",
    "Select at least one collection to search.": "اختر مجموعة واحدة على الأقل للبحث.",
    "Research question": "سؤال بحثي",
    "Evidence cited in this answer": "الأدلة المشار إليها في هذه الإجابة",
    "Page {number}": "الصفحة {number}",
  },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("ria.language");
    if (stored === "en" || stored === "am" || stored === "ar") {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("ria.language", language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      t: (key, values = {}) => {
        let output = translations[language][key] ?? translations.en[key] ?? key;
        for (const [name, replacement] of Object.entries(values)) {
          output = output.replaceAll(`{${name}}`, String(replacement));
        }
        return output;
      },
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function AppearanceControls() {
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("ria.theme");
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("ria.theme", next);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="language-select">{t("Language")}</label>
      <select
        id="language-select"
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="h-10 rounded-full border border-line bg-surface px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
        <option value="ar">العربية</option>
      </select>
      <button
        type="button"
        aria-label={theme === "dark" ? t("Switch to light theme") : t("Switch to dark theme")}
        title={theme === "dark" ? t("Switch to light theme") : t("Switch to dark theme")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        onClick={toggleTheme}
      >
        {theme === "dark" ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
