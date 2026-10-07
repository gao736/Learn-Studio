// Synthetic HTTP fixture matching the separately inspected official price-page structure. Never a model call.
export const fixtureModel='XingChenAGI/Xing4.0-29B';
export function fixturePricing(input='0',output='0'){
  const data=`a:${JSON.stringify({data:{chats:[{modelName:fixtureModel,status:'normal',type:'text',subType:'chat',jsonModeSupport:true,pricing:[{specification:'prompt',price:input},{specification:'completion',price:output}]}]}})}\n`;
  return `<script>self.__next_f.push([1,${JSON.stringify(data)}])</script>`;
}
