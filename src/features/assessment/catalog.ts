import type { Pack, Question } from './domain.ts';
// Server-side curated example; these initial questions and thresholds still need learner calibration.
const sources=[
  {id:'stars',title:'NASA · 恒星',url:'https://science.nasa.gov/universe/stars/'},
  {id:'planets',title:'NASA · 行星定义',url:'https://science.nasa.gov/solar-system/planets/what-is-a-planet/'},
  {id:'moon',title:'NASA · 月球',url:'https://science.nasa.gov/moon/facts/'},
];
type Item={prompt:string;options?:string[];correctIndex?:number;explanation?:string};
function family(skill:string,id:string,items:Item[],explanation:string,sourceIds:string[]):Question[] {
  return items.map((item,i)=>({...item,id:`${skill}-${id}-${i+1}`,skill,family:id,
    hint:'先区分能量来源、运行关系或演化阶段，再按资料中的原理判断。',explanation:item.explanation||explanation,sourceIds,type:item.options?'choice':'written'}));
}
export const astronomyPack:Pack={title:'天文学入门：从诊断到进阶',version:1,sources,
  skills:[
    {id:'light',title:'认识天体与光',prerequisites:[],requiresPractice:false,
      lesson:'太阳是恒星，内部核聚变持续释放能量。行星围绕恒星运行；月球是地球的天然卫星。我们看到月亮和金星的明亮可见光，主要是它们反射的太阳光。把“自身能量来源”“围绕谁运行”“光从哪里来到眼睛”分开判断。太阳系行星定义还要求自身引力使它近似球形，并清除轨道附近区域；不能仅凭“绕太阳”判断它一定是行星。',sourceIds:['stars','planets','moon']},
    {id:'life',title:'理解恒星的一生',prerequisites:['light'],requiresPractice:false,
      lesson:'恒星在气体和尘埃构成的云中形成，引力使物质聚集和升温。主序阶段的核心氢核聚变提供能量；这个阶段占恒星生命中的很大部分。大质量恒星消耗燃料更快、寿命通常更短。太阳这样的恒星晚年会成为红巨星，最后留下白矮星；大质量恒星的结局不同，不能把所有恒星都说成黑洞。',sourceIds:['stars']},
  ],questions:[
    ...family('light','energy',[
      {prompt:'太阳持续发光的主要能量来源是什么？',options:['普通燃烧','内部核聚变','反射卫星的光'],correctIndex:1},
      {prompt:'某天体核心把氢转变为氦。这个过程说明其光能主要来自哪种方式？',options:['天体内部释放能量','反射邻近天体的可见光','接收地球发出的灯光'],correctIndex:0},
      {prompt:'有人把太阳发光解释为“表面像火柴一样燃烧”。哪项修正最合理？',options:['主要能量来自内部核聚变','给太阳提供空气才是主要供能方式','太阳主要靠接收月球反射光供能'],correctIndex:0},
    ],'主序恒星核心的氢核聚变释放能量，不能用普通燃烧或反射来解释。',['stars']),
    ...family('light','identity',[
      {prompt:'太阳属于哪类天体？',options:['恒星','行星','天然卫星'],correctIndex:0},
      {prompt:'新发现的天体位于一个行星系统中心，核心长期进行氢核聚变。应怎样分类？',options:['天然卫星','行星','恒星'],correctIndex:2},
      {prompt:'把地球、太阳、月球分类，哪一个是恒星？',options:['地球','太阳','月球'],correctIndex:1},
    ],'太阳属于恒星，地球属于行星；判断分类要看天体性质，不只看名称。',['stars','planets']),
    ...family('light','reflection',[
      {prompt:'月球的明亮可见光主要来自哪里？',options:['月球内部的氢核聚变','月球表面的普通燃烧','反射太阳光'],correctIndex:2},
      {prompt:'设想一块月面不再受到太阳照射，也没有其他照明。它反射的太阳可见光会怎样？',options:['变暗，因为缺少入射光','不变，因为月岩维持氢核聚变','变得像太阳一样自行供能'],correctIndex:0},
      {prompt:'只观察到一颗行星很亮，能证明它像太阳一样靠内部氢核聚变供能吗？',options:['能，明亮就证明有氢核聚变','不能，明亮可见光可以来自反射','能，距离不会影响任何判断'],correctIndex:1},
    ],'月亮和金星的明亮可见光主要是反射的太阳光。反射需要入射光；明亮不等于内部氢核聚变。',['moon','planets']),
    ...family('light','satellite',[
      {prompt:'月球围绕地球运行，属于哪一类？',options:['恒星','天然卫星','太阳系行星'],correctIndex:1},
      {prompt:'一个天然天体绕某颗行星运行，按这种层次关系，它属于哪一类？',options:['天然卫星','主序恒星','太阳系行星一定围绕另一颗行星'],correctIndex:0},
      {prompt:'简化运行图中，行星乙绕主星甲，天然天体丙绕乙。哪项分类符合图中的关系？',options:['丙因此成为主序恒星','甲因此成为乙的天然卫星','丙是乙的天然卫星'],correctIndex:2},
    ],'天然卫星围绕行星等天体运行；月球是地球的天然卫星，不能把层次关系倒置。',['moon']),
    ...family('light','orbit',[
      {prompt:'太阳系行星主要围绕哪类天体运行？',options:['太阳这颗恒星','月球','其他任意行星'],correctIndex:0},
      {prompt:'在简化太阳系层次图中，哪组直接运行关系适合地球与月球？',options:['地球绕月球，月球绕太阳','地球绕太阳，月球绕地球','太阳绕地球，地球绕月球'],correctIndex:1},
      {prompt:'已知一个天体绕太阳，是否仅凭这一点就能确认它符合太阳系行星定义？',options:['能，凡绕太阳的天体都是行星','不能，因为行星必须绕地球','不能，还须考察引力形成的形状和轨道邻域'],correctIndex:2},
    ],'太阳系的行星围绕太阳运行。完整定义还涉及自身引力使其近似球形和清除轨道附近区域。',['planets','moon']),
    ...family('life','birth',[
      {prompt:'恒星通常诞生于什么环境？',options:['空无一物的区域','气体和尘埃云','已经冷却的纯岩石行星'],correctIndex:1},
      {prompt:'若想寻找正在形成恒星的区域，哪一类区域更值得观察？',options:['完全没有物质的真空','只有成熟白矮星核心的区域','具有高密度气体与尘埃的云'],correctIndex:2},
      {prompt:'给新恒星形成过程排序，哪个起点符合资料？',options:['气体与尘埃先聚集','成熟岩石行星先直接分裂成恒星','白矮星先变成普通燃烧的火球'],correctIndex:0},
    ],'恒星在气体和尘埃云中形成，物质逐步聚集；寻找形成区域要看是否有相应物质。',['stars']),
    ...family('life','gravity',[
      {prompt:'什么作用使形成恒星的云收缩和聚集？',options:['引力','无线电通信','月相变化'],correctIndex:0},
      {prompt:'气体云局部收集了更多物质，引力增强。这个变化通常有利于哪种过程？',options:['让云永远无法聚集','促使更多物质聚集和收缩','直接把所有物质变成月球反射光'],correctIndex:1},
      {prompt:'原恒星尚未稳定进行核心氢核聚变，初期能量主要可以来自什么？',options:['附近行星的普通燃烧','地球的电力传输','初期引力坍缩释放的热量'],correctIndex:2},
    ],'引力促使气体云聚集、收缩和升温；原恒星初期的能量可来自坍缩释放的热量。',['stars']),
    ...family('life','sequence',[
      {prompt:'恒星核心持续进行氢核聚变的主要阶段叫什么？',options:['白矮星阶段','黑洞阶段','主序阶段'],correctIndex:2},
      {prompt:'判断一颗恒星是否在主序阶段，哪项证据最符合这个阶段的定义？',options:['核心稳定将氢聚变为氦','核心已经成为冷却的白矮星','已知它只反射行星光'],correctIndex:0},
      {prompt:'在演化图中，一个阶段的核心稳定进行氢核聚变，且占生命中的很大部分。应标哪个阶段？',options:['冷却白矮星','主序阶段','超新星爆发瞬间'],correctIndex:1},
    ],'主序阶段的核心稳定进行氢核聚变，通常是恒星生命中最长的阶段。',['stars']),
    ...family('life','lifetime',[
      {prompt:'通常哪类恒星消耗燃料更快、寿命更短？',options:['大质量恒星消耗快、通常寿命短','所有恒星寿命完全相同','质量越大必定越长寿'],correctIndex:0},
      {prompt:'某同学只因大质量恒星燃料更多，就推断它更长寿。忽略了哪项关键影响？',options:['所有恒星没有燃料','质量完全不影响燃料消耗','大质量恒星通常以更高速度消耗燃料'],correctIndex:2},
      {prompt:'只考虑一般的质量影响，比较低质量与大质量主序恒星，哪项趋势更合理？',options:['低质量恒星必定立刻爆发','低质量恒星通常消耗更慢、寿命更长','两类恒星的消耗速度必定完全相同'],correctIndex:1},
    ],'大质量恒星燃料消耗快，通常寿命较短；不能仅比较燃料总量，还要比较消耗速度。',['stars']),
    ...family('life','remnant',[
      {prompt:'太阳这样的恒星晚年通常留下哪类致密核心？写出名称。',explanation:'评分依据：白矮星可判正确；只回答黑洞、中子星或超新星不符合太阳这样的恒星结局。'},
      {prompt:'“所有恒星最终都成为黑洞”有什么问题？请用太阳的结局解释。',explanation:'评分依据：需说明结局与恒星质量有关，并以太阳通常留下白矮星为反例；只写一个名词不足以完整解释本题。'},
      {prompt:'像太阳这样的恒星晚年抛掉外层后，外层与残留核心各去向哪里？',explanation:'评分依据：外层形成膨胀的气尘云（行星状星云），核心留下白矮星；两部分均应交代，不能混为黑洞。'},
    ],'恒星结局与质量有关。短答需要授权人员按各题具体依据复核。',['stars']),
  ]};
