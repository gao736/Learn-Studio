import type { Pack, Question } from './domain.ts';
// Server-side curated example; these initial questions and thresholds still need learner calibration.
const sources=[
  {id:'stars',title:'NASA · 恒星',url:'https://science.nasa.gov/universe/stars/'},
  {id:'planets',title:'NASA · 行星定义',url:'https://science.nasa.gov/solar-system/planets/what-is-a-planet/'},
  {id:'moon',title:'NASA · 月球',url:'https://science.nasa.gov/moon/facts/'},
];
function family(skill:string,id:string,prompts:string[],options:string[]|undefined,correctIndex:number|undefined,explanation:string,sourceIds:string[]):Question[] {
  return prompts.map((prompt,i)=>({id:`${skill}-${id}-${i+1}`,skill,family:id,prompt,options,correctIndex,
    hint:explanation.split('。')[0]+'。请把原理应用到题目。',explanation,sourceIds,type:options?'choice':'written'}));
}
export const astronomyPack:Pack={title:'天文学入门：从诊断到进阶',version:1,sources,
  skills:[
    {id:'light',title:'认识天体与光',prerequisites:[],requiresPractice:false,
      lesson:'太阳是恒星，内部核聚变持续释放能量。行星围绕恒星运行；月球是地球的天然卫星。我们看到月亮和金星的明亮可见光，主要是它们反射的太阳光。把“自身能量来源”“围绕谁运行”“光从哪里来到眼睛”分开判断。',sourceIds:['stars','planets','moon']},
    {id:'life',title:'理解恒星的一生',prerequisites:['light'],requiresPractice:false,
      lesson:'恒星在气体和尘埃构成的云中形成，引力使物质聚集和升温。主序阶段的核心氢核聚变提供能量；这个阶段占恒星生命中的很大部分。大质量恒星消耗燃料更快、寿命通常更短。太阳这样的恒星晚年会成为红巨星，最后留下白矮星；大质量恒星的结局不同，不能把所有恒星都说成黑洞。',sourceIds:['stars']},
  ],questions:[
    ...family('light','energy',['太阳持续发光的主要能量来源是什么？','一颗主序恒星持续释放能量，靠的是哪种过程？','普通火焰燃烧能解释主序恒星长期发光吗？选择正确机制。'],['普通燃烧','内部核聚变','反射卫星的光'],1,'主序恒星核心的氢核聚变释放能量，不能用普通燃烧或反射来解释。',['stars']),
    ...family('light','identity',['太阳属于哪类天体？','地球围绕太阳运行；太阳本身是什么类别？','我们最近的一颗恒星是太阳。太阳应归入哪一类？'],['恒星','行星','天然卫星'],0,'太阳属于恒星，地球属于行星。天体的名称不等于天体的类别。',['stars','planets']),
    ...family('light','reflection',['月球的明亮可见光主要来自哪里？','金星的明亮可见光主要是什么光？','太阳光照到月球后，我们能看见月球；这里主要发生了什么？'],['月球或金星的氢核聚变','月球或金星表面的普通燃烧','反射太阳光'],2,'月亮和金星的明亮可见光主要是反射的太阳光；这不同于太阳内部产生能量。',['moon','planets']),
    ...family('light','satellite',['月球围绕地球运行，属于哪一类？','地球的月球在天体分类中叫什么？','在恒星、行星与天然卫星中，哪一类适合描述地球的月球？'],['恒星','天然卫星','太阳系行星'],1,'月球是地球的天然卫星；判断其与地球的运行关系。',['moon']),
    ...family('light','orbit',['太阳系行星主要围绕哪类天体运行？','地球是一颗行星，它围绕什么运行？','按太阳系行星定义，行星的轨道围绕哪个中心天体？'],['太阳这颗恒星','月球','其他任意行星'],0,'太阳系的行星围绕太阳运行。行星完整定义还涉及自身引力使其近似球形和清除轨道附近区域。',['planets']),
    ...family('life','birth',['恒星通常诞生于什么环境？','恒星形成所需的气体与尘埃主要在哪里聚集？','恒星不是凭空出现的，它最初来自哪类物质云？'],['空无一物的区域','气体和尘埃云','已经冷却的纯岩石行星'],1,'恒星在气体和尘埃云中形成，物质逐步聚集。',['stars']),
    ...family('life','gravity',['什么作用使形成恒星的云收缩和聚集？','气体云形成原恒星时，主要由什么使物质聚集？','恒星形成初期，引导云中物质收缩的主要作用是什么？'],['引力','无线电通信','月相变化'],0,'引力促使气体云聚集、收缩，内部温度升高。',['stars']),
    ...family('life','sequence',['恒星核心持续进行氢核聚变的主要阶段叫什么？','太阳目前主要处于哪个生命阶段？','一颗恒星在生命中的很大部分时间靠核心氢核聚变供能，这属于哪个阶段？'],['白矮星阶段','黑洞阶段','主序阶段'],2,'主序阶段的核心氢核聚变供能；不是所有恒星当前都处于同一阶段。',['stars']),
    ...family('life','lifetime',['通常哪类恒星消耗燃料更快、寿命更短？','比较大质量与小质量恒星，大质量恒星的寿命通常怎样？','质量更大的恒星不一定更长寿。下面哪项符合一般规律？'],['大质量恒星消耗快、通常寿命短','所有恒星寿命完全相同','质量越大必定越长寿'],0,'大质量恒星燃料消耗快，通常寿命较短；质量是影响演化的重要因素。',['stars']),
    ...family('life','remnant',['太阳这样的恒星晚年通常留下哪类致密核心？写出名称。','低质量恒星抛掉外层后，像太阳这样的核心通常成为什么？','为什么不能说太阳最后一定成为黑洞？请写出太阳通常留下的核心名称。'],undefined,undefined,'评分依据：回答白矮星可判正确；只回答黑洞、中子星或超新星不符合太阳这样的恒星结局。短答由授权人员按此依据复核。',['stars']),
  ]};
