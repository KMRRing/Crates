// Echo's words, each in English and in Chinese: [English, 中文]. Things a table can clue in one word each, from every
// corner of life: animals, food, things in the house, places, nature, people and jobs, what people do, getting about,
// the body, sport, myth and fantasy, and a few from the trading desk. Simplified characters; British spelling.
export const WORDS = [
  // animals
  ["cat", "猫"], ["dog", "狗"], ["panda", "熊猫"], ["tiger", "老虎"], ["lion", "狮子"], ["elephant", "大象"], ["giraffe", "长颈鹿"], ["monkey", "猴子"],
  ["rabbit", "兔子"], ["horse", "马"], ["cow", "奶牛"], ["pig", "猪"], ["sheep", "绵羊"], ["chicken", "鸡"], ["duck", "鸭子"], ["penguin", "企鹅"],
  ["dolphin", "海豚"], ["whale", "鲸鱼"], ["shark", "鲨鱼"], ["octopus", "章鱼"], ["crab", "螃蟹"], ["snake", "蛇"], ["frog", "青蛙"], ["turtle", "乌龟"],
  ["owl", "猫头鹰"], ["eagle", "老鹰"], ["parrot", "鹦鹉"], ["bat", "蝙蝠"], ["spider", "蜘蛛"], ["bee", "蜜蜂"], ["butterfly", "蝴蝶"], ["ant", "蚂蚁"],
  ["mosquito", "蚊子"], ["kangaroo", "袋鼠"], ["camel", "骆驼"], ["zebra", "斑马"], ["wolf", "狼"], ["fox", "狐狸"], ["bear", "熊"], ["mouse", "老鼠"],
  ["goldfish", "金鱼"], ["peacock", "孔雀"], ["snail", "蜗牛"], ["crocodile", "鳄鱼"], ["squirrel", "松鼠"], ["koala", "考拉"],
  // food and drink
  ["apple", "苹果"], ["banana", "香蕉"], ["orange", "橙子"], ["watermelon", "西瓜"], ["strawberry", "草莓"], ["grape", "葡萄"], ["lemon", "柠檬"],
  ["pineapple", "菠萝"], ["mango", "芒果"], ["durian", "榴莲"], ["rice", "米饭"], ["noodles", "面条"], ["dumpling", "饺子"], ["bread", "面包"],
  ["cake", "蛋糕"], ["chocolate", "巧克力"], ["ice cream", "冰淇淋"], ["cheese", "奶酪"], ["egg", "鸡蛋"], ["milk", "牛奶"], ["coffee", "咖啡"],
  ["tea", "茶"], ["beer", "啤酒"], ["wine", "葡萄酒"], ["pizza", "比萨饼"], ["hamburger", "汉堡包"], ["sushi", "寿司"], ["soup", "汤"], ["salt", "盐"],
  ["sugar", "糖"], ["honey", "蜂蜜"], ["tofu", "豆腐"], ["mooncake", "月饼"], ["popcorn", "爆米花"], ["sandwich", "三明治"], ["chilli", "辣椒"],
  ["garlic", "大蒜"], ["potato", "土豆"], ["tomato", "西红柿"], ["carrot", "胡萝卜"], ["mushroom", "蘑菇"], ["corn", "玉米"], ["peanut", "花生"],
  ["sweets", "糖果"], ["biscuit", "饼干"], ["hotpot", "火锅"], ["bubble tea", "珍珠奶茶"], ["steak", "牛排"], ["salad", "沙拉"], ["butter", "黄油"],
  ["coconut", "椰子"], ["cherry", "樱桃"], ["peach", "桃子"], ["pancake", "煎饼"], ["sausage", "香肠"], ["vinegar", "醋"], ["ketchup", "番茄酱"],
  // things
  ["phone", "手机"], ["computer", "电脑"], ["key", "钥匙"], ["umbrella", "雨伞"], ["clock", "时钟"], ["watch", "手表"], ["glasses", "眼镜"],
  ["camera", "相机"], ["mirror", "镜子"], ["chair", "椅子"], ["table", "桌子"], ["bed", "床"], ["pillow", "枕头"], ["lamp", "台灯"], ["candle", "蜡烛"],
  ["book", "书"], ["pen", "钢笔"], ["pencil", "铅笔"], ["scissors", "剪刀"], ["hammer", "锤子"], ["ladder", "梯子"], ["rope", "绳子"], ["bottle", "瓶子"],
  ["cup", "杯子"], ["chopsticks", "筷子"], ["knife", "刀"], ["spoon", "勺子"], ["plate", "盘子"], ["fridge", "冰箱"], ["television", "电视"],
  ["guitar", "吉他"], ["piano", "钢琴"], ["drum", "鼓"], ["violin", "小提琴"], ["ball", "球"], ["kite", "风筝"], ["balloon", "气球"], ["gift", "礼物"],
  ["wallet", "钱包"], ["money", "钱"], ["coin", "硬币"], ["ticket", "票"], ["map", "地图"], ["flag", "旗子"], ["crown", "王冠"], ["ring", "戒指"],
  ["necklace", "项链"], ["hat", "帽子"], ["shoe", "鞋"], ["sock", "袜子"], ["glove", "手套"], ["scarf", "围巾"], ["tie", "领带"], ["dress", "连衣裙"],
  ["suitcase", "行李箱"], ["backpack", "背包"], ["toothbrush", "牙刷"], ["soap", "肥皂"], ["towel", "毛巾"], ["bell", "铃铛"], ["fan", "扇子"],
  ["sofa", "沙发"], ["window", "窗户"], ["door", "门"], ["stairs", "楼梯"], ["light bulb", "灯泡"], ["battery", "电池"], ["magnet", "磁铁"],
  ["needle", "针"], ["button", "纽扣"], ["envelope", "信封"], ["newspaper", "报纸"], ["calendar", "日历"], ["dice", "骰子"], ["puzzle", "拼图"],
  // places
  ["beach", "海滩"], ["mountain", "山"], ["island", "岛"], ["desert", "沙漠"], ["forest", "森林"], ["river", "河"], ["lake", "湖"], ["ocean", "海洋"],
  ["volcano", "火山"], ["cave", "山洞"], ["city", "城市"], ["village", "村庄"], ["school", "学校"], ["hospital", "医院"], ["airport", "机场"],
  ["station", "车站"], ["library", "图书馆"], ["museum", "博物馆"], ["zoo", "动物园"], ["park", "公园"], ["church", "教堂"], ["temple", "寺庙"],
  ["castle", "城堡"], ["palace", "宫殿"], ["prison", "监狱"], ["bank", "银行"], ["restaurant", "餐厅"], ["hotel", "酒店"], ["kitchen", "厨房"],
  ["garden", "花园"], ["farm", "农场"], ["market", "市场"], ["supermarket", "超市"], ["cinema", "电影院"], ["stadium", "体育场"], ["bridge", "桥"],
  ["tower", "塔"], ["pyramid", "金字塔"], ["Great Wall", "长城"], ["Hong Kong", "香港"], ["Paris", "巴黎"], ["Antarctica", "南极洲"], ["Moon", "月球"],
  ["casino", "赌场"], ["gym", "健身房"], ["bathroom", "浴室"], ["lift", "电梯"], ["harbour", "港口"], ["factory", "工厂"],
  // nature and weather
  ["sun", "太阳"], ["star", "星星"], ["cloud", "云"], ["rain", "雨"], ["snow", "雪"], ["wind", "风"], ["storm", "暴风雨"], ["rainbow", "彩虹"],
  ["lightning", "闪电"], ["thunder", "雷"], ["fire", "火"], ["ice", "冰"], ["tree", "树"], ["flower", "花"], ["rose", "玫瑰"], ["grass", "草"],
  ["leaf", "叶子"], ["stone", "石头"], ["sand", "沙子"], ["gold", "金子"], ["diamond", "钻石"], ["earthquake", "地震"], ["sunrise", "日出"],
  ["sky", "天空"], ["planet", "行星"], ["comet", "彗星"], ["Earth", "地球"], ["spring", "春天"], ["winter", "冬天"], ["bamboo", "竹子"],
  ["waterfall", "瀑布"], ["fog", "雾"], ["wave", "海浪"], ["cactus", "仙人掌"],
  // people and jobs
  ["doctor", "医生"], ["nurse", "护士"], ["teacher", "老师"], ["police officer", "警察"], ["firefighter", "消防员"], ["chef", "厨师"], ["pilot", "飞行员"],
  ["farmer", "农民"], ["soldier", "士兵"], ["king", "国王"], ["queen", "女王"], ["prince", "王子"], ["princess", "公主"], ["pirate", "海盗"],
  ["ninja", "忍者"], ["wizard", "巫师"], ["witch", "女巫"], ["ghost", "鬼"], ["vampire", "吸血鬼"], ["robot", "机器人"], ["alien", "外星人"],
  ["clown", "小丑"], ["astronaut", "宇航员"], ["detective", "侦探"], ["thief", "小偷"], ["judge", "法官"], ["lawyer", "律师"], ["singer", "歌手"],
  ["dancer", "舞蹈演员"], ["painter", "画家"], ["baby", "婴儿"], ["grandmother", "奶奶"], ["bride", "新娘"], ["twins", "双胞胎"],
  ["superhero", "超级英雄"], ["monk", "和尚"], ["emperor", "皇帝"], ["mermaid", "美人鱼"], ["Santa Claus", "圣诞老人"], ["spy", "间谍"],
  ["dentist", "牙医"], ["waiter", "服务员"], ["postman", "邮递员"], ["boss", "老板"],
  // what people do
  ["sleep", "睡觉"], ["dream", "梦"], ["birthday", "生日"], ["wedding", "婚礼"], ["party", "派对"], ["holiday", "假期"], ["travel", "旅行"],
  ["swimming", "游泳"], ["running", "跑步"], ["dancing", "跳舞"], ["singing", "唱歌"], ["cooking", "做饭"], ["shopping", "购物"], ["fishing", "钓鱼"],
  ["camping", "露营"], ["karaoke", "卡拉OK"], ["game", "游戏"], ["music", "音乐"], ["film", "电影"], ["photo", "照片"], ["letter", "信"],
  ["secret", "秘密"], ["love", "爱情"], ["war", "战争"], ["peace", "和平"], ["time", "时间"], ["history", "历史"], ["magic", "魔法"], ["luck", "运气"],
  ["fear", "恐惧"], ["laughter", "笑声"], ["kiss", "吻"], ["hug", "拥抱"], ["race", "比赛"], ["exam", "考试"], ["homework", "作业"], ["work", "工作"],
  ["news", "新闻"], ["internet", "互联网"], ["password", "密码"], ["selfie", "自拍"], ["email", "电子邮件"], ["queue", "排队"],
  ["traffic jam", "堵车"], ["fireworks", "烟花"], ["Christmas", "圣诞节"], ["New Year", "新年"], ["Spring Festival", "春节"], ["lantern", "灯笼"],
  ["red envelope", "红包"], ["snore", "打呼噜"], ["sneeze", "打喷嚏"], ["hiccups", "打嗝"], ["yawn", "打哈欠"], ["whisper", "悄悄话"],
  // getting about
  ["car", "汽车"], ["bus", "公共汽车"], ["train", "火车"], ["aeroplane", "飞机"], ["ship", "轮船"], ["bicycle", "自行车"], ["motorbike", "摩托车"],
  ["taxi", "出租车"], ["underground", "地铁"], ["helicopter", "直升机"], ["rocket", "火箭"], ["submarine", "潜水艇"], ["tractor", "拖拉机"],
  ["lorry", "卡车"], ["ambulance", "救护车"], ["hot-air balloon", "热气球"], ["skateboard", "滑板"], ["tram", "有轨电车"], ["parachute", "降落伞"],
  ["passport", "护照"],
  // the body
  ["eye", "眼睛"], ["ear", "耳朵"], ["nose", "鼻子"], ["mouth", "嘴巴"], ["tooth", "牙齿"], ["hair", "头发"], ["hand", "手"], ["foot", "脚"],
  ["heart", "心脏"], ["brain", "大脑"], ["bone", "骨头"], ["blood", "血"], ["finger", "手指"], ["knee", "膝盖"], ["beard", "胡子"], ["smile", "微笑"],
  ["tears", "眼泪"], ["shadow", "影子"], ["skeleton", "骷髅"], ["tattoo", "纹身"],
  // sport and games
  ["football", "足球"], ["basketball", "篮球"], ["tennis", "网球"], ["golf", "高尔夫"], ["table tennis", "乒乓球"], ["badminton", "羽毛球"],
  ["boxing", "拳击"], ["skiing", "滑雪"], ["surfing", "冲浪"], ["chess", "国际象棋"], ["mahjong", "麻将"], ["kung fu", "功夫"], ["yoga", "瑜伽"],
  ["marathon", "马拉松"], ["Olympics", "奥运会"], ["goal", "进球"], ["referee", "裁判"], ["medal", "奖牌"], ["trophy", "奖杯"], ["cards", "扑克牌"],
  // myth and fantasy
  ["dragon", "龙"], ["dinosaur", "恐龙"], ["unicorn", "独角兽"], ["treasure", "宝藏"], ["mummy", "木乃伊"], ["zombie", "僵尸"], ["spaceship", "宇宙飞船"],
  ["time machine", "时光机"], ["monster", "怪物"], ["giant", "巨人"], ["angel", "天使"], ["devil", "魔鬼"], ["heaven", "天堂"], ["fairy", "仙女"],
  ["sword", "剑"], ["shield", "盾牌"], ["bow", "弓"], ["cannon", "大炮"], ["bomb", "炸弹"], ["tank", "坦克"],
  // from the trading desk
  ["oil", "石油"], ["tanker", "油轮"], ["stock market", "股市"], ["contract", "合同"], ["bitcoin", "比特币"], ["container", "集装箱"], ["diesel", "柴油"],
  ["salary", "工资"], ["tax", "税"], ["coffee break", "茶歇"],
];
