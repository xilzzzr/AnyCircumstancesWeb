export type GuideLanguage = "en" | "es" | "ru" | "fr" | "zh";
export const GUIDE_LANGUAGE_KEY = "uac_quick_guide_language";
export const guideLanguages: { value: GuideLanguage; label: string }[] = [
  { value: "en", label: "English" }, { value: "es", label: "Español" },
  { value: "ru", label: "Русский" }, { value: "fr", label: "Français" },
  { value: "zh", label: "简体中文" },
];

type GuidePage = { label: string; headline: string; body: string; callout: string; cta: string };
type GuideContent = {
  dialogTitle: string; dialogSubtitle: string; languageLabel: string;
  previous: string; next: string; pageCount: string; goToPage: string; languageNote: string;
  pages: [GuidePage, GuidePage, GuidePage, GuidePage, GuidePage];
};

export function isGuideLanguage(value: string | null): value is GuideLanguage {
  return guideLanguages.some(language => language.value === value);
}

export function initialGuideLanguage(): GuideLanguage {
  try {
    const saved = localStorage.getItem(GUIDE_LANGUAGE_KEY);
    if (isGuideLanguage(saved)) return saved;
  } catch { /* The guide also works when storage is unavailable. */ }
  const browserLanguage = typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase().split(/[-_]/)[0];
  return isGuideLanguage(browserLanguage) ? browserLanguage : "en";
}

export const quickGuideContent: Record<GuideLanguage, GuideContent> = {
  "en": {
    "dialogTitle": "How AnyCircumstances works",
    "dialogSubtitle": "A quick guide to setting up your protection.",
    "languageLabel": "Guide language",
    "previous": "Previous page",
    "next": "Next page",
    "pageCount": "{current} of {total}",
    "goToPage": "Go to page {page}",
    "languageNote": "This setting only changes the language of this guide.",
    "pages": [
      {
        "label": "THE BASICS",
        "headline": "Your protection works in a simple cycle",
        "body": "AnyCircumstances keeps important files in your encrypted vault and uses scheduled check-ins to make sure you're okay. If you miss a check-in and your grace period ends, the files you selected for emergency access can be delivered to your verified contacts.",
        "callout": "You stay in control of what is stored, who receives it, and when delivery can happen.",
        "cta": "Upload your first file"
      },
      {
        "label": "YOUR VAULT",
        "headline": "Add the files that matter",
        "body": "Upload documents and information you may want available in an emergency. Your files are encrypted before upload. You decide which files are included in emergency access and which trusted contacts should receive them.",
        "callout": "You can return to your vault anytime to add, remove, or review files.",
        "cta": "Upload files"
      },
      {
        "label": "TRUSTED CONTACTS",
        "headline": "Choose who should receive your information",
        "body": "Add the people you trust to receive selected files if emergency delivery is triggered. Each contact must verify their email before they can receive access. You choose which files each person is allowed to receive.",
        "callout": "A contact only receives the files you specifically assign to them.",
        "cta": "Add contacts"
      },
      {
        "label": "CHECK-INS",
        "headline": "Check in to keep the timer running",
        "body": "Your schedule tells AnyCircumstances how often you need to confirm that you're okay. When a check-in is due, enter your regular check-in PIN to reset the timer. If you instead enter the emergency PIN you created during signup, AnyCircumstances immediately starts delivering the files you assigned to your verified emergency contacts.",
        "callout": "Use your regular check-in PIN when you are safe. Your emergency PIN is an emergency trigger and does not wait for a missed check-in or grace period. Any other incorrect PIN logs you out.",
        "cta": "Check in now"
      },
      {
        "label": "GRACE PERIOD",
        "headline": "Missing a check-in does not send your files immediately",
        "body": "If you miss a scheduled check-in, your grace period begins first. During this time, AnyCircumstances sends reminders so you still have time to check in. If the grace period ends without a successful check-in, emergency delivery can begin for the files and contacts you configured.",
        "callout": "You can adjust your grace period and reminder settings to fit your needs.",
        "cta": "Set your grace period"
      }
    ]
  },
  "es": {
    "dialogTitle": "Cómo funciona AnyCircumstances",
    "dialogSubtitle": "Una guía rápida para configurar tu protección.",
    "languageLabel": "Idioma de la guía",
    "previous": "Página anterior",
    "next": "Página siguiente",
    "pageCount": "{current} de {total}",
    "goToPage": "Ir a la página {page}",
    "languageNote": "Esta opción solo cambia el idioma de esta guía.",
    "pages": [
      {
        "label": "LO ESENCIAL",
        "headline": "Tu protección funciona en un ciclo sencillo",
        "body": "AnyCircumstances guarda archivos importantes en tu bóveda cifrada y utiliza verificaciones programadas para confirmar que estás bien. Si no realizas una verificación y termina tu período de gracia, los archivos que seleccionaste para acceso de emergencia pueden enviarse a tus contactos verificados.",
        "callout": "Tú decides qué se guarda, quién lo recibe y cuándo puede realizarse la entrega.",
        "cta": "Subir tu primer archivo"
      },
      {
        "label": "TU BÓVEDA",
        "headline": "Añade los archivos importantes",
        "body": "Sube documentos e información que quieras tener disponibles en una emergencia. Tus archivos se cifran antes de subirse. Tú decides qué archivos se incluyen en el acceso de emergencia y qué contactos de confianza deben recibirlos.",
        "callout": "Puedes volver a tu bóveda en cualquier momento para añadir, eliminar o revisar archivos.",
        "cta": "Subir archivos"
      },
      {
        "label": "CONTACTOS DE CONFIANZA",
        "headline": "Elige quién debe recibir tu información",
        "body": "Añade a las personas de confianza que deben recibir los archivos seleccionados si se activa la entrega de emergencia. Cada contacto debe verificar su correo electrónico antes de poder recibir acceso. Tú eliges qué archivos puede recibir cada persona.",
        "callout": "Cada contacto recibe únicamente los archivos que le hayas asignado específicamente.",
        "cta": "Añadir contactos"
      },
      {
        "label": "VERIFICACIONES",
        "headline": "Regístrate para mantener activo el temporizador",
        "body": "Tu horario indica a AnyCircumstances con qué frecuencia debes confirmar que estás bien. Cuando llegue el momento, introduce tu PIN normal de verificación para reiniciar el temporizador. Si introduces el PIN de emergencia que creaste al registrarte, AnyCircumstances comienza inmediatamente a enviar los archivos que asignaste a tus contactos de emergencia verificados.",
        "callout": "Usa tu PIN normal de verificación cuando estés a salvo. Tu PIN de emergencia activa una entrega inmediata y no espera a que pierdas una verificación ni a que termine el período de gracia. Cualquier otro PIN incorrecto cerrará tu sesión.",
        "cta": "Verificarme ahora"
      },
      {
        "label": "PERÍODO DE GRACIA",
        "headline": "Perder una verificación no envía tus archivos inmediatamente",
        "body": "Si no realizas una verificación programada, primero comienza tu período de gracia. Durante este tiempo, AnyCircumstances envía recordatorios para que todavía tengas oportunidad de verificarte. Si el período de gracia termina sin una verificación correcta, puede comenzar la entrega de emergencia de los archivos y contactos que configuraste.",
        "callout": "Puedes ajustar el período de gracia y los recordatorios según tus necesidades.",
        "cta": "Configurar período de gracia"
      }
    ]
  },
  "ru": {
    "dialogTitle": "Как работает AnyCircumstances",
    "dialogSubtitle": "Краткое руководство по настройке вашей защиты.",
    "languageLabel": "Язык руководства",
    "previous": "Предыдущая страница",
    "next": "Следующая страница",
    "pageCount": "{current} из {total}",
    "goToPage": "Перейти на страницу {page}",
    "languageNote": "Эта настройка меняет язык только этого руководства.",
    "pages": [
      {
        "label": "ОСНОВЫ",
        "headline": "Ваша защита работает по простому циклу",
        "body": "AnyCircumstances хранит важные файлы в вашем зашифрованном хранилище и использует запланированные отметки, чтобы убедиться, что с вами всё в порядке. Если вы пропустите отметку и закончится льготный период, выбранные вами для экстренного доступа файлы могут быть переданы подтверждённым доверенным контактам.",
        "callout": "Вы сами решаете, что хранить, кому передавать информацию и когда может произойти передача.",
        "cta": "Загрузить первый файл"
      },
      {
        "label": "ВАШЕ ХРАНИЛИЩЕ",
        "headline": "Добавьте важные файлы",
        "body": "Загрузите документы и информацию, которые могут понадобиться в экстренной ситуации. Файлы шифруются до загрузки. Вы сами выбираете, какие файлы доступны при экстренной передаче и какие доверенные контакты должны их получить.",
        "callout": "Вы можете в любое время вернуться в хранилище, чтобы добавить, удалить или проверить файлы.",
        "cta": "Загрузить файлы"
      },
      {
        "label": "ДОВЕРЕННЫЕ КОНТАКТЫ",
        "headline": "Выберите, кто должен получить вашу информацию",
        "body": "Добавьте людей, которым вы доверяете получение выбранных файлов в случае экстренной передачи. Каждый контакт должен подтвердить свой адрес электронной почты, прежде чем получить доступ. Вы сами выбираете, какие файлы сможет получить каждый человек.",
        "callout": "Контакт получает только те файлы, которые вы специально назначили ему.",
        "cta": "Добавить контакты"
      },
      {
        "label": "ОТМЕТКИ",
        "headline": "Отмечайтесь вовремя, чтобы обновлять таймер",
        "body": "Ваш график определяет, как часто AnyCircumstances просит подтвердить, что с вами всё в порядке. Когда наступает время отметки, введите обычный PIN для отметки, чтобы сбросить таймер. Если вместо него ввести экстренный PIN, созданный при регистрации, AnyCircumstances немедленно начнёт передачу назначенных файлов вашим подтверждённым экстренным контактам.",
        "callout": "Когда вы в безопасности, используйте обычный PIN для отметки. Экстренный PIN немедленно запускает передачу и не ждёт пропущенной отметки или окончания льготного периода. При вводе любого другого неправильного PIN вы выйдете из аккаунта.",
        "cta": "Отметиться сейчас"
      },
      {
        "label": "ЛЬГОТНЫЙ ПЕРИОД",
        "headline": "Пропущенная отметка не отправляет ваши файлы сразу",
        "body": "Если вы пропустили запланированную отметку, сначала начинается льготный период. В это время AnyCircumstances отправляет напоминания, чтобы у вас оставалось время отметиться. Если льготный период закончится без успешной отметки, может начаться экстренная передача настроенных вами файлов доверенным контактам.",
        "callout": "Вы можете настроить продолжительность льготного периода и количество напоминаний под свои потребности.",
        "cta": "Настроить льготный период"
      }
    ]
  },
  "fr": {
    "dialogTitle": "Comment fonctionne AnyCircumstances",
    "dialogSubtitle": "Un guide rapide pour configurer votre protection.",
    "languageLabel": "Langue du guide",
    "previous": "Page précédente",
    "next": "Page suivante",
    "pageCount": "{current} sur {total}",
    "goToPage": "Aller à la page {page}",
    "languageNote": "Ce réglage modifie uniquement la langue de ce guide.",
    "pages": [
      {
        "label": "L'ESSENTIEL",
        "headline": "Votre protection fonctionne selon un cycle simple",
        "body": "AnyCircumstances conserve vos fichiers importants dans votre coffre chiffré et utilise des confirmations programmées pour vérifier que tout va bien. Si vous manquez une confirmation et que votre délai de grâce se termine, les fichiers sélectionnés pour l'accès d'urgence peuvent être transmis à vos contacts vérifiés.",
        "callout": "Vous décidez de ce qui est stocké, de qui le reçoit et du moment où la transmission peut avoir lieu.",
        "cta": "Téléverser votre premier fichier"
      },
      {
        "label": "VOTRE COFFRE",
        "headline": "Ajoutez les fichiers importants",
        "body": "Téléversez les documents et informations que vous souhaitez rendre disponibles en cas d'urgence. Vos fichiers sont chiffrés avant leur téléversement. Vous choisissez les fichiers inclus dans l'accès d'urgence et les contacts de confiance qui doivent les recevoir.",
        "callout": "Vous pouvez revenir à votre coffre à tout moment pour ajouter, supprimer ou consulter des fichiers.",
        "cta": "Téléverser des fichiers"
      },
      {
        "label": "CONTACTS DE CONFIANCE",
        "headline": "Choisissez qui doit recevoir vos informations",
        "body": "Ajoutez les personnes de confiance qui doivent recevoir les fichiers sélectionnés si la transmission d'urgence est déclenchée. Chaque contact doit vérifier son adresse e-mail avant de pouvoir recevoir un accès. Vous choisissez les fichiers que chaque personne est autorisée à recevoir.",
        "callout": "Un contact reçoit uniquement les fichiers que vous lui avez expressément attribués.",
        "cta": "Ajouter des contacts"
      },
      {
        "label": "CONFIRMATIONS",
        "headline": "Confirmez votre présence pour relancer le minuteur",
        "body": "Votre calendrier indique à AnyCircumstances à quelle fréquence vous devez confirmer que tout va bien. Lorsqu'une confirmation est attendue, saisissez votre PIN habituel pour relancer le minuteur. Si vous saisissez plutôt le PIN d'urgence créé lors de l'inscription, AnyCircumstances commence immédiatement à transmettre les fichiers attribués à vos contacts d'urgence vérifiés.",
        "callout": "Lorsque vous êtes en sécurité, utilisez votre PIN habituel. Le PIN d'urgence déclenche une transmission immédiate, sans attendre une confirmation manquée ni la fin du délai de grâce. Tout autre PIN incorrect vous déconnecte.",
        "cta": "Confirmer maintenant"
      },
      {
        "label": "DÉLAI DE GRÂCE",
        "headline": "Manquer une confirmation n'envoie pas immédiatement vos fichiers",
        "body": "Si vous manquez une confirmation programmée, votre délai de grâce commence d'abord. Pendant cette période, AnyCircumstances envoie des rappels afin que vous ayez encore le temps de confirmer votre présence. Si le délai de grâce se termine sans confirmation réussie, la transmission d'urgence peut commencer pour les fichiers et contacts que vous avez configurés.",
        "callout": "Vous pouvez ajuster votre délai de grâce et vos rappels selon vos besoins.",
        "cta": "Configurer le délai de grâce"
      }
    ]
  },
  "zh": {
    "dialogTitle": "AnyCircumstances 如何运作",
    "dialogSubtitle": "快速了解如何设置您的保护。",
    "languageLabel": "指南语言",
    "previous": "上一页",
    "next": "下一页",
    "pageCount": "第 {current} 页，共 {total} 页",
    "goToPage": "转到第 {page} 页",
    "languageNote": "此设置只会更改本指南的语言。",
    "pages": [
      {
        "label": "基本原理",
        "headline": "您的保护按照一个简单的流程运行",
        "body": "AnyCircumstances 将重要文件保存在加密保险库中，并通过定期签到确认您的安全状态。如果您错过签到并且宽限期结束，您选择用于紧急访问的文件可以发送给已验证的可信联系人。",
        "callout": "由您决定保存哪些内容、谁可以接收，以及何时可以进行发送。",
        "cta": "上传第一个文件"
      },
      {
        "label": "您的保险库",
        "headline": "添加重要文件",
        "body": "上传您希望在紧急情况下可以访问的文件和信息。文件会在上传之前进行加密。由您决定哪些文件可以用于紧急访问，以及哪些可信联系人可以接收这些文件。",
        "callout": "您可以随时返回保险库添加、删除或查看文件。",
        "cta": "上传文件"
      },
      {
        "label": "可信联系人",
        "headline": "选择谁可以接收您的信息",
        "body": "添加您信任的人，以便在触发紧急发送时接收您选择的文件。每位联系人必须先验证其电子邮箱才能获得访问权限。您可以决定每个人能够接收哪些文件。",
        "callout": "联系人只会收到您明确分配给他们的文件。",
        "cta": "添加联系人"
      },
      {
        "label": "签到",
        "headline": "按时签到以重新开始计时",
        "body": "您的签到计划决定 AnyCircumstances 多久需要您确认一次安全状态。需要签到时，请输入普通签到 PIN 来重新开始计时。如果您改为输入注册时创建的紧急 PIN，AnyCircumstances 会立即开始向已验证的紧急联系人发送您分配给他们的文件。",
        "callout": "确认安全时，请使用普通签到 PIN。紧急 PIN 会立即触发发送，不会等待错过签到或宽限期结束。输入任何其他错误 PIN 都会让您退出登录。",
        "cta": "立即签到"
      },
      {
        "label": "宽限期",
        "headline": "错过签到不会立即发送您的文件",
        "body": "如果您错过了计划签到，系统会先进入宽限期。在此期间，AnyCircumstances 会发送提醒，让您仍有时间完成签到。如果宽限期结束时仍未成功签到，系统可以开始向您设置的联系人发送指定的紧急文件。",
        "callout": "您可以根据自己的需要调整宽限期和提醒设置。",
        "cta": "设置宽限期"
      }
    ]
  }
};
