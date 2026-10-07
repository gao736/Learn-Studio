// Explicit simulation fixture, never a claimed model output or learning outcome.
export const fixtureMaterial = {
  title: '认识恒星与行星', scope: '建立入门概念，暂不涉及天体物理计算', weeklyTopics: ['恒星、行星与卫星'],
  lesson: { title:'恒星、行星与卫星', outcome:'解释太阳与金星的发光区别',
    sections:[{ heading:'太阳的光', body:'太阳是恒星，主要通过内部核聚变释放能量。金星是行星，我们看到它的可见光主要是反射太阳光。月球是地球的天然卫星。', sourceIds:['s1'] }],
    practice:'用自己的话解释：很亮的天体为什么不一定是恒星？',
    questions:[
      { id:'q1', prompt:'太阳主要依靠什么持续释放能量？', options:['反射','核聚变','普通燃烧'], correctIndex:1, explanation:'太阳内部发生核聚变。', sourceIds:['s1'] },
      { id:'q2', prompt:'太阳属于哪类天体？', options:['恒星','行星','卫星'], correctIndex:0, explanation:'太阳是恒星。', sourceIds:['s1'] },
      { id:'q3', prompt:'金星的明亮可见光主要来自哪里？', options:['灯光','自身聚变','反射太阳光'], correctIndex:2, explanation:'金星反射太阳光。', sourceIds:['s1'] },
      { id:'q4', prompt:'本课中恒星与行星的关键区别是？', options:['视大小','聚变条件','运动与否'], correctIndex:1, explanation:'主序恒星具有维持氢聚变的条件。', sourceIds:['s1'] },
      { id:'q5', prompt:'月球属于哪类天体？', options:['天然卫星','恒星','行星'], correctIndex:0, explanation:'月球是地球的天然卫星。', sourceIds:['s1'] },
    ],
  },
};
