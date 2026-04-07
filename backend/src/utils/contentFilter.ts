/**
 * Content filtering utilities for chat messages
 * Provides slur detection and blurring functionality
 */

// Comprehensive profanity filter - English
const ENGLISH_SLURS = [
  // Strong profanity
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckup', 'fuckwit', 'fuckface',
  'shit', 'shitty', 'shitting', 'shithead', 'shitface', 'bullshit',
  'cunt', 'cunting', 'cunts',
  'ass', 'asshole', 'asshat', 'asswipe', 'dumbass', 'badass',
  'bitch', 'bitching', 'bitched', 'sonofabitch', 'sonofabitches',
  'bastard', 'bastards', 'l bastard',
  
  // Sexual content
  'pussy', 'pussies', 'dick', 'dicks', 'dickhead', 'dickwad', 'cock', 'cocks', 'cock sucker',
  'whore', 'whores', 'slut', 'sluts', 'slutty', 'hooker', 'hookers', 'prostitute',
  'rape', 'raping', 'rapist', 'molest', 'molestation', 'pedophile', 'pedophilia',
  'nude', 'naked', 'nudity', 'porn', 'pornography', 'porno', 'erotic',
  'sex', 'sexual', 'intercourse', 'orgasm', 'orgasms', 'masturbate', 'masturbation',
  'penis', 'vagina', 'clitoris', 'testicles', 'breasts', 'boobs', 'tits', 'nipples',
  
  // Racial and ethnic slurs
  'nigger', 'nigga', 'niggers', 'niggas', 'niglet',
  'chink', 'chinks', 'gook', 'gooks', 'spic', 'spics', 'wetback', 'wetbacks',
  'kike', 'kikes', 'heeb', 'hebes', 'kyke', 'kykes',
  'wop', 'wops', 'dego', 'dego', 'guinea', 'guineas',
  'paki', 'pakis', 'raghead', 'ragheads', 'sandnigger', 'sandniggers',
  'cracker', 'crackers', 'honkey', 'honkeys', 'honky', 'honkies',
  'redskin', 'redskins', 'injun', 'injuns', 'savage', 'savages',
  
  // LGBTQ+ slurs
  'fag', 'faggot', 'faggots', 'faggy', 'fagging',
  'dyke', 'dykes', 'lesbo', 'lesbos', 'queer', 'queers',
  'tranny', 'trannies', 'shemale', 'shemales', 'ladyboy', 'ladyboys',
  
  // Disability and mental health slurs
  'retard', 'retarded', 'retards', 'retardation',
  'spastic', 'spastics', 'cripple', 'cripples', 'gimp', 'gimps',
  'lunatic', 'lunatics', 'insane', 'madman', 'madmen',
  
  // General insults
  'idiot', 'idiots', 'stupid', 'stupidity', 'moron', 'morons', 'imbecile', 'imbeciles',
  'loser', 'losers', 'jerk', 'jerks', 'jerkoff', 'jerkoffs',
  'douche', 'douchebag', 'douchebags', 'douche nozzle',
  'sucker', 'suckers', 'suck', 'sucking', 'sucks',
  'twat', 'twats', 'wanker', 'wankers', 'tosser', 'tossers',
  
  // Violence and threats
  'kill', 'killing', 'kills', 'murder', 'murdering', 'murders', 'murderer',
  'death', 'dead', 'die', 'dying', 'suicide', 'suicidal',
  'terrorist', 'terrorism', 'bomb', 'bombing', 'bombs', 'explode', 'explosion',
  'shoot', 'shooting', 'shoots', 'shot', 'gun', 'guns', 'weapon', 'weapons',
  'stab', 'stabbing', 'stabs', 'knife', 'knives', 'cut', 'cutting', 'cuts',
  
  // Drug references
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'methamphetamine', 'crack', 'weed',
  'marijuana', 'pot', 'lsd', 'ecstasy', 'addict', 'addicts', 'addiction',
  
  // Body fluids and functions
  'piss', 'pissing', 'pissed', 'pissed off', 'urine', 'urinating',
  'cum', 'cumming', 'semen', 'ejaculate', 'ejaculation',
  'feces', 'fecal', 'defecate', 'defecation', 'poop', 'pooping',
  
  // Religious slurs and blasphemy
  'goddamn', 'goddammit', 'jesus christ', 'jesus fucking christ',
  'allah', 'muslim', 'muslims', 'jew', 'jews', 'christian', 'christians',
  
  // Gender-based slurs
  'bimbo', 'bimbos', 'gold digger', 'gold diggers', 'slutty', 'tramp', 'tramps',
  'manwhore', 'manwhores', 'player', 'players', 'womanizer', 'womanizers',
  
  // Age-related slurs
  'old fart', 'old farts', 'geezer', 'geezers', 'coot', 'coots',
  
  // Other offensive terms
  'hate', 'hating', 'racist', 'racism', 'sexist', 'sexism',
  'nazi', 'nazis', 'hitler', 'fascist', 'fascism', 'kkk', 'klan',
  'satan', 'satanic', 'devil', 'demonic', 'hell', 'damn', 'damned',
];

const RUSSIAN_SLURS = [
  // === БАЗОВЫЙ МАТ (дополнен) ===
  'шлюха', 'курва', 'давалка', 'проститутка', 'блядь', 'бля', 'блядство', 'блядун', 'блядунья', 'потаскуха', 'профурсетка', 'манда', 'мандовошка', 'пизда', 'пиздец', 'спиздить', 'пиздюк', 'пиздёж',
  'хуй', 'хуйло', 'хуила', 'хуёвый', 'нахуй', 'похуй', 'охуеть', 'хуячить', 'хуесос', 'хуйня', 'хуйню', 'хер', 'хрен', 'херня', 'херовый', 'фиг', 'фигня',
  'елда', 'елдак', 'залупа', 'залупка', 'головка', 'пенис', 'член', 'писюн', 'пиписька', 'пися', 'сиськи', 'титьки', 'сосок', 'жопа', 'жопка', 'жополиз', 'очко', 'анус', 'срака', 'сральник',
  'мудак', 'мудила', 'мудозвон', 'гондон', 'гандон', 'чмо', 'чмошник', 'ублюдок', 'ублюдище', 'выродок', 'падла', 'падлюка', 'скот', 'быдло', 'быдловатый', 'редиска', 'овощ', 'тварь', 'мразь', 'гад', 'гадина', 'сволочь', 'сучка', 'сука', 'кобель', 'козёл', 'козлиная', 'баран', 'осёл', 'свинья', 'собака', 'псина', 'шавка', 'шакал', 'крыса', 'вошь', 'гнида', 'стерва', 'стервоза', 'злыдень', 'чучело', 'урод', 'уродина', 'страшила', 'крокодил', 'обезьяна', 'обезьянка', 'мартышка', 'макака',
  'петух', 'петушара', 'кукареку', 'индюк', 'боров', 'хряк', 'хорь', 'шампиньон', 'кактус', 'яйца', 'мошонка',
  'дрочить', 'дрочка', 'онанизм', 'секс', 'трахать', 'трахаться', 'сношать', 'сношение', 'совокупление', 'минет', 'кунилингус', 'фелляция', 'оральный', 'анилингус', 'фистинг', 'бдсм', 'садо-мазо', 'порно', 'порнография', 'голый', 'обнажённый', 'эротика', 'разврат', 'похоть', 'оргазм', 'эякуляция', 'сперма', 'кончать', 'кончил',

  // === ЛГБТ (согласно закону о пропаганде) ===
  'пидор', 'пидр', 'пидорас', 'педик', 'петух', 'гомик', 'гомосек', 'гомосексуалист', 'гомосексуализм', 'гей', 'лесби', 'лесбиянка', 'лесбуха', 'бисексуал', 'трансгендер', 'транссексуал', 'трансвестит', 'квир', 'интерсекс', 'небинарный', 'гендерквир', 'содомит', 'содомия', 'мужеложец', 'педераст', 'голубой', 'розовый', 'синий', 'радужный', 'радуга', 'прайд', 'гей-парад', 'лгбт', 'лгбт-сообщество', 'нетрадиционные отношения', 'нетрадиционная ориентация', 'пропаганда лгбт', 'однополый брак', 'семья из двух отцов', 'гомофоб', 'гомофобия',

  // === НАЦИОНАЛЬНЫЕ И РАСОВЫЕ ОСКОРБЛЕНИЯ (экстремизм) ===
  'хач', 'хачик', 'чурка', 'чурбан', 'черножопый', 'черномазый', 'черножопик', 'узкоглазый', 'косоглазый', 'раскосый', 'жид', 'жидовка', 'жидок', 'жидомасон', 'хохол', 'хохлушка', 'хохляцкий', 'кацап', 'кацапка', 'москаль', 'москалька', 'русня', 'русская свинья', 'ватник', 'колорад', 'укроп', 'укропка', 'бандеровец', 'бандера', 'бандерлог', 'азер', 'армяшка', 'армяк', 'цыган', 'цыгане', 'цыганка', 'таджик', 'таджик поганый', 'узбек', 'киргиз', 'китаеза', 'китаёза', 'китаеза поганый', 'панголин', 'вьетконг', 'корешка', 'индус', 'индуист', 'араб', 'арап', 'мусульманин', 'мусульмане', 'исламист', 'джихадист', 'ваххабит', 'негр', 'нигер', 'ниггер', 'черный', 'белый', 'европеец', 'пиндос', 'янки', 'фриц', 'ганс', 'француз-лягушатник', 'итальяшка', 'испанец', 'немчура', 'англичанка гадит', 'лимита', 'лимитчик', 'лимита поганая', 'чужой', 'инородец', 'нацист', 'фашист', 'неонацист', 'расист', 'скинхед', 'свастика', 'коловрат', 'зига', 'зиговать', 'зигующий',

  // === ПОЛИТИЧЕСКИЕ ОСКОРБЛЕНИЯ И ДИСКРЕДИТАЦИЯ (власть, армия) ===
  'путин', 'пуйло', 'путлер', 'путиноид', 'путинский режим', 'кровавый режим', 'тирания', 'диктатура', 'путинщина', 'путинизм', 'рашист', 'рашизм', 'рашистский', 'орк', 'орки', 'мордор', 'кремлебот', 'зомби-ящик', 'пропагандон', 'зомбированный', 'ватный', 'колорадский жук', 'спидола', 'попса', 'гнилой либерал', 'либераст', 'либерда', 'либерашка', 'хохлосрач', 'москальский', 'кацапский', 'жидовский', 'жидобандеровец', 'русофоб', 'русофобия', 'ненавистник россии', 'вс рф', 'российская армия', 'военнослужащие', 'спецоперация', 'сво', 'z-операция', 'киллеры', 'наёмники', 'чвк вагнера', 'мясорубка', 'пушечное мясо', 'оккупант', 'оккупационные войска', 'захватчик', 'агрессор', 'убийцы', 'мародёры', 'генерал мясников', 'десантники', 'спецназ', 'полиция', 'менты', 'мусор', 'легавый', 'мусора', 'полицаи', 'гэбня', 'кэгэбэшник', 'фсбшник', 'прокурор продажный', 'судья подкупный', 'депутат вор', 'чиновник-вор', 'единоросс', 'едрос', 'партия жуликов и воров', 'кремль', 'правительство', 'госдума', 'совет федерации', 'президент', 'премьер-министр',

  // === НАРКОТИКИ (пропаганда, призывы) ===
  'наркотик', 'наркота', 'наркомания', 'наркоман', 'наркоманка', 'торчок', 'торч', 'торчать', 'обкуренный', 'улететь', 'приход', 'амфетамин', 'фен', 'винт', 'экстази', 'mdma', 'лсд', 'кислота', 'марихуана', 'анаша', 'конопля', 'каннабис', 'гашиш', 'план', 'бошки', 'шишки', 'трава', 'травка', 'спайс', 'миксы', 'курительные смеси', 'мефедрон', 'меф', 'соль', 'кристалл', 'кокаин', 'кокс', 'крэк', 'героин', 'метамфетамин', 'мет', 'метадон', 'опий', 'опиаты', 'морфий', 'закладка', 'клад', 'закладчик', 'кладмен', 'ширка', 'ширяться', 'уколоться', 'вена', 'шприц', 'найз', 'кодеин', 'трамадол', 'лирика', 'прегабалин', 'спайс', 'снюс', 'насвай', 'насвайчик', 'нюхать', 'дорожка', 'бомбит', 'солевая',

  // === СУИЦИД (призывы и темы) ===
  'суицид', 'самоубийство', 'самоубийца', 'повеситься', 'застрелиться', 'прыгнуть с крыши', 'перерезать вены', 'отравиться', 'кинуть петлю', 'колхоз-рулетка', 'суицидник', 'скулшутинг', 'колумбайн', 'синий кит', 'разбиться', 'убить себя', 'лишить себя жизни', 'депрессия', 'мертвый', 'смерть', 'умри', 'умирай', 'сдохни', 'подохни', 'ликвидироваться', 'уйти из жизни', 'жизнь не нужна', 'не хочу жить', 'свести счёты с жизнью',

  // === ТЕРРОРИЗМ И ЭКСТРЕМИЗМ ===
  'терракт', 'террорист', 'террористический акт', 'взрывчатка', 'взрывное устройство', 'самодельное взрывное устройство', 'сву', 'бомба', 'взрыв', 'подрыв', 'граната', 'автомат', 'пистолет', 'оружие', 'боеприпасы', 'патроны', 'коктейль молотова', 'зажигательная смесь', 'шахид', 'шахидка', 'джихад', 'исламское государство', 'игил', 'аль-каида', 'талибан', 'хамас', 'хезболла', 'смертник', 'стрельба', 'расстрел', 'захват заложников', 'линчевание', 'самосуд', 'расправа', 'убийство', 'убийца', 'насилие', 'насильник', 'насиловать', 'изнасилование', 'уничтожить', 'ликвидировать', 'сжечь', 'поджечь', 'резать', 'зарезать', 'прирезать', 'задушить', 'утопить', 'четвертовать', 'распять',

  // === РЕЛИГИОЗНЫЕ ОСКОРБЛЕНИЯ ===
  'аллах', 'пророк мухаммед', 'исус', 'христос', 'бог', 'господь', 'свинья в адрес мусульман', 'кафир', 'неверный', 'православный', 'христианин', 'батюшка', 'поп', 'ксёндз', 'раввин', 'имам', 'мулла', 'сатана', 'дьявол', 'бес', 'кощунство', 'богохульство', 'осквернение', 'плевок на крест', 'смерть православию', 'смерть исламу', 'аятолла', 'ваххабизм', 'салафизм', 'крестовый поход', 'инквизиция',

  // === ОСКОРБЛЕНИЯ ЛИЧНОСТИ, ИНВАЛИДНОСТИ, ВНЕШНОСТИ ===
  'даун', 'дауны', 'дебил', 'дебилы', 'имбицил', 'олигофрен', 'слабоумный', 'кретин', 'идиот', 'тупой', 'тупица', 'бездарь', 'ничтожество', 'ноль', 'пустое место', 'недоумок', 'тормоз', 'колода', 'дубина', 'балбес', 'оболтус', 'олух', 'ротозей', 'разгильдяй', 'нахал', 'наглец', 'хам', 'грубиян', 'негодяй', 'подлец', 'мерзавец', 'злодей', 'изверг', 'садист', 'маньяк', 'педофил', 'зоофил', 'некрофил', 'экcгибиционист', 'вуайерист', 'калека', 'инвалид', 'слепой', 'глухой', 'немой', 'хромой', 'безногий', 'безрукий', 'горбатый', 'карлик', 'лилипут', 'толстый', 'жирный', 'жиртрест', 'жиробас', 'худой', 'кожа да кости', 'скелет', 'доходяга', 'дистрофик', 'псих', 'сумасшедший', 'ненормальный', 'шизофреник', 'параноик', 'психопат', 'невротик', 'истеричка',

  // === ПРИЗЫВЫ К НАРУШЕНИЮ ЗАКОНА, МАССОВЫМ БЕСПОРЯДКАМ ===
  'митинг', 'протест', 'революция', 'майдан', 'свержение', 'бунт', 'погром', 'перекрыть дороги', 'голодовка', 'забастовка', 'не платить налоги', 'уклониться от мобилизации', 'саботаж', 'диверсия', 'вооруженное сопротивление', 'захватить власть', 'выйти на улицы', 'призывы к беспорядкам', 'организация нпа', 'финансирование экстремизма',

  // === СЛЕНГ ИНТЕРНЕТА, УНИЧИТЕЛЬНЫЕ НАЗВАНИЯ ===
  'нуб', 'рач', 'додик', 'дод', 'кринж', 'кринжовый', 'школьник', 'пионер', 'дед инсайд', 'форточник', 'скважина', 'пахан', 'кабан', 'чушок', 'шкелет', 'шконка', 'чмошник', 'опущенный', 'рваный', 'фраер', 'фраерок', 'лох', 'лохушка', 'лошара', 'рогоносец', 'рогатый', 'петух гнилой', 'шестёрка', 'шестерочка', 'бычара', 'быдлан', 'гопник', 'гопота', 'урка', 'уголовник', 'блатной', 'блатняк', 'мафия', 'братва', 'бандит',

  // === ДОПОЛНИТЕЛЬНЫЕ ОБЩИЕ ОСКОРБЛЕНИЯ ===
  'проклятый', 'проклятье', 'ад', 'адский', 'дьявольский', 'сатанинский', 'чёрт', 'чёртов', 'бесовский', 'предатель', 'изменник', 'предатель родины', 'коллаборационист', 'пособник', 'наймит', 'шпион', 'диверсант', 'вредитель'
];

const RUSSIAN_REGEX_SLURS = [
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?ху[йеёяию][а-яё]*/i,
  /^(?:на|по|за|от|вы|при|под|пере|не|до|о|об|обо|рас|с)?пизд[а-яё]*/i,
  /^(?:уеб|заеб|доеб|выеб|отъеб|въеб|объеб|разъеб|съеб)[а-яё]*/i,
  /^(?:еба|ебу|ебл|ебн|ёбн)[а-яё]*/i,
  /^(?:бля|бляд|ублюд)[а-яё]*/i,
  /^(?:муда|мудо)[а-яё]*/i,
  /^г[ао]ндон[а-яё]*/i,
  /^чмо(?:ш|шн)?[а-яё]*/i,

  /^(?:на|по|за|от|вы|при|под|пере|раз|с)?(?:манда|залуп|письк|писюн|пиписк|сиськ|титьк|жоп|очк|срак|перд|бзд|сц|ср)[а-яё]*/i,
  /^(?:не)?(?:петух|петуш)[а-яё]*(?:арь|иный|оватый)?/i,   // осторожно – может ловить домашнюю птицу
  /^(?:пед(?:ерик|ераст)|гомос[а-яё]*|лесб[а-яё]*)/i,
  /^(?:наци(?:ст|к)|фаши(?:ст|к)|скинхед|коловрат|свастик)/i,
  /^(?:уби|смерт|самоуби|суицид|террор|взрыв|бомб|стрел|расстрел)/i,
  /^(?:нарк(?:отик|оман|ота)|амфет|метадон|героин|кокаин|спайс|мефедрон)/i,
  /^(?:путин(?:оид|ский|щина)|путлер|рашист|кремлебот|ватник|укроп|бандеровец|хохол|кацап|москаль|чурка|жид|негр)/i
];

// Combined slur list for static matching
const SLURS = [...ENGLISH_SLURS, ...RUSSIAN_SLURS];

// Leet speak variations (Latin)
const LEET_VARIATIONS = {
  '4': 'a', '@': 'a',
  '3': 'e', '£': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o', '()': 'o',
  '$': 's', '5': 's',
  '7': 't', '+': 't',
  '8': 'b', '6': 'b',
  '9': 'g', 'q': 'g',
  '2': 'z', 'z': 'z',
  'ck': 'c', 'kk': 'c',
  'ph': 'f', 'ff': 'f',
  'gh': 'g',
  'x': 'ks', 'cs': 'x',
};

// Cyrillic lookalikes to prevent bypasses like "xуй" (Latin x)
const CYRILLIC_LOOKALIKES = {
  'a': 'а', 'p': 'р', 'o': 'о', 'x': 'х', 'y': 'у', 
  'e': 'е', 'c': 'с', 'k': 'к', '3': 'з', '0': 'о',
};

/**
 * Detects if text contains Cyrillic characters
 */
function containsCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

/**
 * Converts leet speak to normal characters for detection (Latin)
 */
function normalizeLatinText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9]/g, '');
  
  for (const [leet, normal] of Object.entries(LEET_VARIATIONS)) {
    const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
  }
  return normalized;
}

/**
 * Converts leet speak to normal characters for detection (Cyrillic)
 */
function normalizeCyrillicText(text: string): string {
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\u0400-\u04FFё]/g, ''); // Added 'ё' explicitly
  
  // 1. Replace leet speak numbers/symbols to Latin letters
  for (const [leet, normal] of Object.entries(LEET_VARIATIONS)) {
    const escapedLeet = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLeet, 'g'), normal);
  }

  // 2. Convert Latin lookalikes back to Cyrillic
  for (const [latin, cyrillic] of Object.entries(CYRILLIC_LOOKALIKES)) {
    const escapedLatin = latin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    normalized = normalized.replace(new RegExp(escapedLatin, 'g'), cyrillic);
  }
  return normalized;
}

/**
 * Converts leet speak to normal characters for detection (multilingual)
 */
function normalizeText(text: string): string {
  if (containsCyrillic(text)) {
    return normalizeCyrillicText(text);
  }
  return normalizeLatinText(text);
}

/**
 * Checks if a message contains slurs (using arrays and regex)
 */
function containsSlur(text: string): boolean {
  const words = text.split(/(\s+)/).filter(w => w.trim());
  
  for (const word of words) {
    const normalized = normalizeText(word);
    const originalLower = word.toLowerCase();
    
    // Check static arrays
    for (const slur of SLURS) {
      const slurLower = slur.toLowerCase();
      const slurNormalized = normalizeText(slur);
      
      if (originalLower.includes(slurLower) || normalized.includes(slurNormalized)) {
        return true;
      }
    }
    
    // Check Regex roots
    for (const regex of RUSSIAN_REGEX_SLURS) {
      if (regex.test(originalLower) || regex.test(normalized)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Blurs/detects slurs in text by replacing them with asterisks
 */
export function blurSlurs(text: string): string {
  const words = text.split(/(\s+)/); 
  const blurredWords = words.map(word => {
    if (!word.trim()) return word;
    
    const normalizedWord = normalizeText(word);
    const originalLower = word.toLowerCase();
    let isSlur = false;

    // 1. Check Russian Regex Patterns First
    for (const regex of RUSSIAN_REGEX_SLURS) {
      if (regex.test(originalLower) || regex.test(normalizedWord)) {
        isSlur = true;
        break;
      }
    }

    // 2. Check Static Slurs Array if Regex didn't catch it
    if (!isSlur) {
      for (const slur of SLURS) {
        const slurLower = slur.toLowerCase();
        const slurNormalized = normalizeText(slur);
        
        if (originalLower.includes(slurLower) || 
            normalizedWord.includes(slurNormalized) ||
            slurNormalized === normalizedWord) {
          isSlur = true;
          break;
        }
      }
    }
    
    if (isSlur) {
      return '*'.repeat(word.length);
    }
    
    return word;
  });
  
  return blurredWords.join('');
}

/**
 * Checks if a message contains inappropriate content
 */
export function hasInappropriateContent(text: string): boolean {
  return containsSlur(text);
}

/**
 * Filters a chat message by blurring any inappropriate content
 */
export function filterChatMessage(message: string): string {
  return blurSlurs(message);
}