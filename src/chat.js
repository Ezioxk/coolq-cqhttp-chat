const fs=require('fs');
const app=require('./bot');
const bot=app.bot;
const Levenshtein=require('./similar');
const tAlp=require('./tencentAi');
const config={//请修改配置
    useTencentAlp:1,//是否使用腾讯ai的对话,0为不使用，1位使用
    similarity:0.5,//启用腾讯ai后优先使用学习的对话，低于一定相似度再调用腾讯的
    cqImagePath:'D:\\Program Files\\CQP-Orange\\CQ_Pro\\data\\image\/',//请修改为酷Q的image目录
    storagePath:'D:\\Program Files\\CQP-Orange\\CQ_Pro\\data\\emoji\/'//请修改为学习对话时，下载的图片想要存放的目录
};
let KEI = 90;

let chatJson={};
function loadChat() {
    fs.readFile('src/chat.json',function(err,data){
        if(err){
            console.error(err);
            console.log("读取词库失败，请检查");
        }
        else{
            let src = data.toString();//将二进制的数据转换为字符串
            chatJson = JSON.parse(src);//将字符串转换为json对象
        }
    });
}

function send_msg(context, returnMessage) {
    bot('send_msg', {
        message_type: context.message_type,
        user_id: context.group_id || context.user_id || context.discuss_id,
        group_id: context.group_id || context.user_id || context.discuss_id,
        discuss_id: context.group_id || context.user_id || context.discuss_id,
        message: returnMessage
    });
}
function sleep(delay) {
        var start = (new Date()).getTime();
        while ((new Date()).getTime() - start < delay) {
        continue;
        }
  }

function chats(){
    loadChat();

    bot.on('message', async context => {
        var sign = new String(context.message);
        switch(sign.substring(0,7)){
            case "学习#":
                return 0;
            case "安静模式#":
                KEI=20;
                send_msg(context,"喵~");
                break;
            case "狂暴模式#":
                KEI=90;
                send_msg(context,"不要停下来啊啊啊啊啊啊啊啊啊");
                break;
            case "普通模式#":
                send_msg(context,"水群模式启动");
                break;
            case "圣教国亘古不灭":
                KEI= 99;
                send_msg(context,"教徒生生不息");
                break;
            case "肃静":
                KEI= 10;
                send_msg(context,"嘘");
                break;
            case "多说点#":
                KEI += 10;
                break;
            case "少说点#":
                KEI -=10;
                break;
            case "KEI#":
                send_msg(context,"KEI值为"+KEI);
                break;
            default:
                break;

        }
   
        let max_similar=[];
        let i=0,maxIndex;
        chatJson.chat.forEach(function (item) {//获取所有回答里的相似度并存进数组
            max_similar[i++]=Levenshtein.LevenshteinDistance.init(context.message.replace(/\[(\S*)]/g,''),item.ask).get();
        });
        let max_value=Math.max.apply(null, max_similar);
        let returnMessage='';
        if (config.useTencentAlp===1&&(max_value<config.similarity)) {
           returnMessage=await tAlp.tencentAlp(context.message);
            if (returnMessage===''){
                let replys=["www","你真棒!","真的嘛?","然后呢~","Awesome!","Really?","And then?","すごい！","本当に？","それで","真系架？","点解既？","你好叻啊！","圣帝是这样说的吗？",];//实在没得回复的万能回复
                returnMessage=replys[Math.floor(Math.random()*replys.length)];
            }
        }else {
            if (max_value===0){
                returnMessage='本小姐还没学过这个呢';
            }else {
                maxIndex=max_similar.indexOf(Math.max.apply(null, max_similar));//获取相似度最高的问题的下标
                let replyArray=chatJson.chat[maxIndex].reply;
                returnMessage=replyArray[Math.floor(Math.random()*replyArray.length)]//随机匹配问题下的一个回答
            }
        }
        // 样本数组
    
        if((num=Math.floor(Math.random()*returnMessage.length*100)%100)<KEI){
            console.log(num);
            sleep(num);
            send_msg(context, returnMessage);
        };
    });

}


function learn(){
    let json={};
    bot.on("message",context=>{
        let arr=context.message.split('|');
        if (context.message.indexOf('学习#')>=0){
            if (typeof(arr[2])=='undefined') { 
                send_msg(context,"你是笨蛋吗，这么简单的指令都不会用");

                return 0;
            }
            if(arr[1].length<4){
                send_msg(context,"为了更好地匹配，问题的长度至少为4哦~");
                
                return 0;
            }
            let img;
            try{
                img=context.message.match(/\[CQ:image,file=(\S*)]/)[1].replace(/,url=(\S*)term=2/,"");
                console.log(img);
                bot('get_image', {
                    file:img
                }).then(res=>{
                    console.log('下载成功');
                    fs.rename(`${config.cqImagePath}\\${img}`,`${config.storagePath}\\${img}`,function(err){
                        if(err){
                            console.log("移动失败");
                            throw err;
                        }
                        console.log("移动成功")
                    })
                }).catch(err=>{
                    console.log("下载失败")
                });
            }catch(e){
                console.log("无图片mode");
            }
            fs.readFile('src/chat.json',function(err,data){
                if(err){
                    send_msg(context,"词库读取失败，本小姐暂时无法学习");
                }
                else{
                    arr[2]=arr[2].replace(/(?<=CQ:image,file=).*?((?=,)|(?=]))/,`file:///${config.storagePath}\\${img}`).replace(/,url=(\S*)term=2/,"");
                    let src = data.toString();
                    let flag=0;//判断问题是否存在的标志,0=未学习过,1=问题已存在,2=回答已存在
                    json = JSON.parse(src);//将字符串转换为json对象
                    json.chat.forEach(function (item) {
                        if (arr[1]===item.ask){//问题已经存在的情况下
                            item.reply.forEach(function (c_reply,index) {
                                if (c_reply===arr[2]){
                                    flag=2;
                                    send_msg(context,"本小姐已经学习过这个对话了，你是笨蛋嘛");
                                }
                            });
                            if (flag!==2) {
                                flag=1;
                                item.reply.push(arr[2]);
                            }
                        }
                    });
                    if (flag!==2) {
                        if (flag===0){
                            let params = {
                                "ask":arr[1],
                                "reply":[arr[2]]
                            };
                            json.chat.push(params);
                        }
                        let str = JSON.stringify(json,"","\t");
                        fs.writeFile('src/chat.json',str,function(err){
                            if(err){
                                send_msg(context,"词库读取失败，本小姐暂时无法学习");
                            }
                        });
                       send_msg(context,"本小姐学习完啦~");
                        loadChat();//重新读取json
                    }
                }
            });
        }
    })
}
function load(){
    chats();
    learn();
}
module.exports = {
    load
};