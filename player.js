var share 		= '../../Share';
var define 		= require(share+'/base_define');
var myutil		= require(share+'/myutil');
var op       = require(share+'/op');
var playerDao = require('../classes/dao/playerDao');
var mynet     = require(share+'/net');
var timer     = require(share+'/timer');
var Hero        = require('./hero/Hero');
var Equip       = require('./item/equip');
var container = require(share+'/container');
var selectRank = require(share+'/data/RankStageData').selectRank;
var TalentBox   = require('./talent/talentBox');
var ItemBox   = require('./item/itemBox');
var LuckyBox   = require('./lucky/luckyBox');
var PVELevelBox   = require('./pve/PVELevelBox');
var lvlInfomationData = require(share+'/data/lvlInfomationData').data;
var heroInfoData      = require(share+'/data/HeroInfoData').data;
//var equipInfoData      = require(share+'/data/EquipInfoData');
var HonorManager    = require('../server/honor/honorManager');
var EnergyManager   = require('../server/energy/energy');
var BattleCountManager = require('./pve/BattleCount')
var UseTower        = require('../server/usetower/usetower');
var masterRemote    = require('../server/remote/masterRemote');
var playerManager = require('../server/playerManager');
var EquipInfoData = require(share+'/data/EquipInfoData').data;
var awardWrapper = require('./activity/award');
var marketMsg = require('./msg/op_s_fs_market');
var LOG			= myutil.LOG;
var ERROR		= myutil.ERROR;
var cbFunc  = myutil.cbFunc;
var Struct  = op.Struct;
var BILOG   = myutil.BILOG;

var WIN_RATIO  = 1.2;
var FAILED_RATIO = 0.8;

var Player = module.exports = function () {
    this.sockObj = null;
    this._account = "";
    this._charname = "";
    this._guid = 0;

    this.state = 0;
    this.cacheMsg = [];

    this.offlineTime = null;
    this.loginTime = null;

    this._level = 0;
    this._exp = 0;
    this._gold = 0;
    this._rmb = 0;
    this._diamond = 0;
    this._diamond_give = 0;
    this._energy = 0;

    this._buyBattleCount = 0; // 购买挑战次数个数
    this._lastBuyBattleCountTime = 0; // 最后购买挑战次数时间

    this._useTalentPoint = 0;

    this._points = 0;
    this._rank = 0;
    this._lucky = 0;
    this._step = 0;
    this._nextTollgate = 0;
    this._isReward = 0;

//    this.mapid = 1;
//    this.maplevel = 1;

    this.talentBox = new TalentBox(this);
    this.itemBox   = new ItemBox(this);
    this.pveLevelBox = new PVELevelBox(this);
    this.luckyBox = new LuckyBox(this);
    this.honorManager = new HonorManager(this);
    this.useTower = new UseTower(this);
    this.energyManager = new EnergyManager(this);
    this.battleCountManager = new BattleCountManager(this);
    this.heros = {};
    this.selctedHero = undefined;
    this.model = 0;
    //this.equips = null;

    this.equipsOnHero = {};

 	this.lastSignInTime = undefined;
    this.signInCount = 0;

    this.lastGambleSlotTime = 0;
    this.gambleSlotCount = 0;
    this.lastGambleFruitTime = 0;
    this.gambleFruitCount = 0;

    this.gambleSlot1 = -1;
    this.gambleSlot2 = -1;
    this.gambleSlot3 = -1;

    // only valid in fighting state
    this.fightTeam = -1;

    this.rechargeTotal = 0;

    // 记录，如活动奖励是否领取过，首冲奖励是否领取过
    this.record = {};

    this.pveRand = null;

    this.device_id = "dummy";
    this.matchTime = 0;

    this.propMarket = {};
};


Player.prototype.init = function(session){
    var self = this;
    self.talentBox.init(cbFunc(function(err, data){
        if(err){
            LOG('player talent init error : ' + self._guid);
        }else{
            mynet.sendSTalentListRet(session, data);
        }
    }));

    self.itemBox.init(cbFunc(function(err, data){
        if(err){
            LOG('player item init error : ' + self._guid);
        }else{
            mynet.sendSItemListRet(session, data);
        }
    }));

    self.pveLevelBox.init(cbFunc(function(err, data){
        if(err){
            LOG('pveLevelBox init error : ' + self._guid);
        } else {
            mynet.sendPlayerPveData(session, data);
        }
    }));
};


Player.prototype.gm_upLevel = function(level, cb){
    var self = this;
    self._level = level ;
    if(self._level > 30){
        self._level = 30;
    }

    this.updateDb(['level', 'exp'],[self._level, self._exp]);
    cb(null, {level : self._level});
};


Player.prototype.getTalentBox = function(){
    return this.talentBox ;
};


Player.prototype.getItemBox = function(){
    return this.itemBox ;
};

Player.prototype.getLuckyBox = function(){
    return this.luckyBox ;
};

Player.prototype.getPVELevelBox = function(){
    return this.pveLevelBox;
};

Player.prototype.setLevel = function(level){
    this._level = level;
};
Player.prototype.level = function(){
    return this._level
};

Player.prototype.points = function(){
    return this._points;
};

Player.prototype.setStep = function(step){
    this._step = step;
};

Player.prototype.lucky = function(){
    return this.luckyBox.getLucky();
};


Player.prototype.setLucky = function(lucky){
    this._lucky = lucky;
    this.updateDb(['lucky'], [this._lucky]);
};



Player.prototype.setExp = function(exp){
    this._exp = exp;
};
Player.prototype.exp = function(){
    return this._exp
};

//人民币
Player.prototype.setDiamond = function(v){
    this._diamond = v;
    this.updateDb(['diamond'], [this._diamond]);
};

//赠送
Player.prototype.setDiamond_give = function(v){
    this._diamond_give = v;
    this.updateDb(['diamond_give'], [this._diamond_give]);
};

Player.prototype.diamond = function(){
    return this._diamond;
};

Player.prototype.diamond_give = function(){
    return this._diamond_give;
};

Player.prototype.diamond_all = function(){
    return this._diamond + this._diamond_give;
};

Player.prototype.setRMB = function(rmb){
    this._rmb = rmb;

    this.updateDb(['rmb'], [this._rmb]);
};

Player.prototype.rmb = function(){
    return this._rmb;
};

Player.prototype.setEnergy = function(energy){
    this._energy = energy;
    this.updateDb(['energy'], [this._energy]);
};
Player.prototype.energy = function(){
    return this._energy;
};

Player.prototype.setBattleCount = function(count, time){
    this._buyBattleCount = count; // 购买挑战次数个数
    if(isNaN(time)){
        this.updateDb(['battleCountBuyNum'], [count]);
    } else {
        this.updateDb(['battleCountBuyNum', 'lastUpdateBCTime'], [count, time]);
        this._lastUpdateBCTime = time;
    }
}

Player.prototype.battleCount = function(){
    // 如果最后更新时间不是当天则初始化
    if(this._lastUpdateBCTime != undefined && !timer.curDay(this._lastUpdateBCTime)){
        this.setBattleCount(0, parseInt(timer.nowDate()));
    }
    return this._buyBattleCount;
}

Player.prototype.setGold = function(gold){
    this._gold = gold;

    this.updateDb(['gold'], [this._gold]);
};
Player.prototype.gold = function(){
    return this._gold
};

// str 格式：1010:2:xxx
Player.prototype.isMoneyEnough = function(str){
    var arr = str.split(":");
    var _type = parseInt(arr[0]);
    var itemID = parseInt(arr[1]);
    var count = parseInt(arr[2]);
    if(_type == 1010){
        switch (itemID){
            case define.CURRENCY.RMB:
                return {flag: this.rmb() >= count,
                        rmb: -count};
                break;
            case define.CURRENCY.DIAMOND:
                return {flag: this.diamond() >= count,
                        diamond: -count};
                break;
            case define.CURRENCY.EXP:
                return {flag: this.exp() >= count,
                        exp: -count};
                break;
            case define.CURRENCY.GOLD:
                return {flag: this.gold() >= count,
                        gold: -count};
                break;
            case define.CURRENCY.ENERGY:
                return {flag: this.energy() >= count,
                    energy: -count};
                break;
        }
    }
}

//Player.prototype.getMapid = function(){
//    return this.mapid;
//}

//Player.prototype.getMaplevel = function(){
//    return this.maplevel;
//}

Player.prototype.setUseTalentPoint = function(useTalentPoint){
    this._useTalentPoint = useTalentPoint;
    this.updateDb(['useTalentPoint'],[this._useTalentPoint]);
};
Player.prototype.useTalentPoint = function(){
    return this._useTalentPoint
};
Player.prototype.checkTalentPoint = function(){
    var self = this;
    return self.level() > self.useTalentPoint() ;
};


Player.prototype.updateDb = function(fields, values){
    var self = this;
    playerDao.update(fields, values, self._guid, cbFunc(function(err, data){
        if(err){
            LOG('updateDb : player update db error  : ' + self._guid);
        }
    }));
};


Player.prototype.clear = function(){
    this.sockObj = null;
    this._account = "";
    this._guid = 0;
    this._charname = "";
    this.cacheMsg = [];
};

Player.prototype.login = function(){
    this.loginTime = Date.now();
    var sockObj = this.getSession();

    if (sockObj == null)
    {
        this.updateDb(["last_login_time"], [parseInt(new Date().getTime()/1000)]);
    }
    else
    {
        this.updateDb(["last_login_time","last_login_ip"], [parseInt(new Date().getTime()/1000), "'" + sockObj.remoteIP() + "'"]);
    }
    this.BILOG("login");
};

Player.prototype.kickOffline = function(){
    if(this.sockObj){
        this.sockObj.kickOff();
        this.sockObj = null;  
        this.setOffline();
    }
};

Player.prototype.setOffline = function() {
    this.offlineTime = Date.now();
    this.recordRecord(timer.nowDate, "offlineTime");
    this.recordRecord(this.energyManager.energyTime, "energyTime");
    this.recordRecord(this.pveLevelBox.PVEdropData, "PVEdrop");

    var luckyBox = this.getLuckyBox();
    if (luckyBox.save)
    {
        luckyBox.save = false;
        luckyBox.saveDb();
    }
};

Player.prototype.getOfflineTime = function(){
	return this.offlineTime;
};

Player.prototype.sockError = function(){
    this.sockObj = null;
    this.setOffline();
};

Player.prototype.pushCacheMsg = function(msg){
    this.cacheMsg.push(msg);
};

Player.prototype.getCacheMsg = function(){
    return this.cacheMsg;
};

Player.prototype.clearMsg = function(){
    this.cacheMsg = [];
};

Player.prototype.setSockObj = function(sock){
    this.sockObj = sock;

    if(this.sockObj){
        sock.container = this;
        LOG("player",this.guid(),"relate sock",sock.id());
    }
};

Player.prototype.getSession = function(){
    return this.sockObj;
};

Player.prototype.getGUID = function(){
    return this._guid;
};

Player.prototype.guid = function(){
    return this._guid;
};

Player.prototype.getCharName = function(){
    return this._charname;
};

Player.prototype.charname = function(){
    return this._charname;
};

Player.prototype.getModel = function(){
    return this.model;
};


Player.prototype.setModel = function(model){
    this.model = model;
};


Player.prototype.account = function(){
    return this._account;
};

Player.prototype.setState = function(_state){
    this.state = _state;
};

Player.prototype.getState = function(){
    return this.state;
};

Player.prototype.setBaseInfo = function(option){
    this._account = option.account;
    this._charname = option.charname;
    this._guid = option.id;
    this._exp = option.exp;
    this._level = option.level;
    this._gold = option.gold;
    this._diamond = option.diamond;
    this._diamond_give = option.diamond_give;
    this._rmb = option.rmb;
    this.model = option.model;
    this._energy = option.energy;

    this._buyBattleCount = option.battleCountBuyNum;
    this._lastUpdateBCTime = option.lastUpdateBCTime;

    this._useTalentPoint = option.useTalentPoint;
    this.setPointsRanK(option.level, option.points);
    this._lucky = option.lucky;

	//this._skillPoint = option.skillPoint;
    this.selctedHero = option.selctHero;
	this.lastSignInTime = option.last_signin_time;
    this.signInCount = option.signin_count;
//    this.mapid = option.mapid;
//    this.maplevel = option.maplevel;

    this.lastGambleSlotTime = option.last_gamble_slot_time;
    this.gambleSlotCount = option.gamble_slot_count;
    this.lastGambleFruitTime = option.last_gamble_fruit_time;
    this.gambleFruitCount = option.gamble_fruit_count;

    this.gambleSlot1 = option.gamble_slot1;
    this.gambleSlot2 = option.gamble_slot2;
    this.gambleSlot3 = option.gamble_slot3;

    this.rechargeTotal = option.recharge_total || 0;

    this._step = option.step;
    this._nextTollgate = option.nextTollgate;
    this._isReward = option.isReward;

    this.device_id = option.device_id || "dummy";
    this.os_type = option.os_type || "dummy";
    this.phone_type = option.phone_type || "dummy";
    this.store = option.store || "dummy";

    try{
        this.record = JSON.parse(option.record || "{}");
        this.pveRand = this.getRecord("pveRand");
        this.CurrLevelId = this.getRecord("CurrLevelId");
    }
    catch(e){
        ERROR("parse record error ...."+this.guid()+" record="+option.record);
    }
};

Player.prototype.getBaseInfoPack = function() {
    var allActivity = require(share+'/data/ActivityData');
    var cumuAct = allActivity.getCumuRechargetAct();
    var cumuMoney = this.getRecord(5030, cumuAct.startTime);
    if(cumuMoney == null || cumuMoney == undefined){
        cumuMoney = 0;
    }
    return  {
        charname: this.charname(),
        guid: this.guid(),
        model: this.model,
        level: this.level(),
        exp: this.exp(),
        usePoint: this.useTalentPoint(),
        gold: this.gold(),
        diamond : this.diamond_all(),
        energy: this.energy(),
        energyBuyNum:this.energyManager.energyBuyNum,
        energyRecTime:this.energyManager.energyTime,
        lastSignInTime: this.lastSignInTime,
        signInCount: this.signInCount,
        serverTime: timer.nowDate(),
        selctHero : this.selctedHero,
//        mapid : this.mapid,
//        maplevel : this.maplevel,
        lastGambleSlotTime : this.lastGambleSlotTime,
        gambleSlotCount : this.gambleSlotCount,
        lastGambleFruitTime : this.lastGambleFruitTime,
        gambleFruitCount : this.gambleFruitCount,
        gambleSlot1 : this.gambleSlot1,
        gambleSlot2 : this.gambleSlot2,
        gambleSlot3 : this.gambleSlot3,
        rechargeTotal : cumuMoney,//this.rechargeTotal,
        getFirstRechargeAward : this.record[define.ActivityType.FIRST_RECHARGE] || 0,
        //skillPoint : this._skillPoint,
        lucky : this.lucky(),
        points : this._points,
        step : this._step,
        nextTollgate : this._nextTollgate,
        isReward : this._isReward,
        battleCountBuyNum : this.battleCount()
    };
};

Player.prototype.sendMsg = function(msg){
    this.sockObj.sendMsg(msg);
};

Player.prototype.sendByteMsg = function(opcode, data){
    if(this.sockObj){
        this.sockObj.sendByteBuffer(opcode, data);
    }
    else{
        //ERROR("player",this.guid()," offline to send opcode", opcode);
    }
};

Player.prototype.isFighting = function(){
    return this.getState() == define.PlayerStatus.FIGHT_ING;
};

Player.prototype.getSelctHero = function(){
    return this.selctedHero;
};

Player.prototype.setSelctHero = function(id, model){
    this.selctedHero = id;
    this.model = model;
    this.updateDb(['selctHero', 'model'], [id, model]);
};

Player.prototype.getHero = function(instID){
    return this.heros[instID];
};

Player.prototype.isEquipOnHero = function(equipId){
    for(var id in this.heros){
        var inst = this.heros[id];
        if(inst.equipOnHero(equipId)){
            return true;
        }
    }
    return false;
};

Player.prototype.setHeroEquip = function(heroInst, equipID, idx){
    var oldEquipID = heroInst.setEquip(equipID, idx);
    if(oldEquipID != -1){
        delete this.equipsOnHero[oldEquipID];
    }
    this.equipsOnHero[equipID] = heroInst.id;
};
Player.prototype.addHero = function(option){
    var baseInfo = heroInfoData[option.typeID];
    if(baseInfo){
        var inst = new Hero({owner: this,
                             id: option.id,
                             typeID: option.typeID,
                             level : option.level || 1,
                             exp : option.exp || 0,
                             baseInfo: baseInfo,
                             skillPoint: option.skillPoint || 0,
                             skill1Lvl: option.skill1Lvl || 1,
                             skill2Lvl: option.skill2Lvl || 1,
                             skill3Lvl: option.skill3Lvl || 1,
                             equipPos1: option.equipPos1 || -1,
                             equipPos2: option.equipPos2 || -1,
                             equipPos3: option.equipPos3 || -1,
                             equipPos4: option.equipPos4 || -1,
                             equipPos5: option.equipPos5 || -1,
                             equipPos6: option.equipPos6 || -1});
        this.heros[option.id] = inst;

        if(inst.equipPos1 != -1){
            this.equipsOnHero[inst.equipPos1] = inst.id;
        }
        if(inst.equipPos2 != -1){
            this.equipsOnHero[inst.equipPos2] = inst.id;
        }
        if(inst.equipPos3 != -1){
            this.equipsOnHero[inst.equipPos3] = inst.id;
        }
        if(inst.equipPos4 != -1){
            this.equipsOnHero[inst.equipPos4] = inst.id;
        }
        if(inst.equipPos5 != -1){
            this.equipsOnHero[inst.equipPos5] = inst.id;
        }
        if(inst.equipPos6 != -1){
            this.equipsOnHero[inst.equipPos6] = inst.id;
        }
        return inst;
    }
    else{
        return null;
    }
};


Player.prototype.addHeroByPush = function(option, msg, cb){
    var self = this;

    masterRemote.getGlobalHeroId(null, cbFunc(function(cbOption){
        option.id = cbOption.heroId;
        var hero = self.addHero(option);
        if(hero){
            self.honorManager.updateHeronumHonor(self.heros);
            self.setSelctHero(hero.id, hero.typeID);
            var dbOption = {id: hero.id, playerID: self.guid(), typeID: hero.typeID};
            playerDao.insertHero(dbOption,
                cbFunc(function(result){
                    if(result){
                        LOG("[DB]insertHero success "+self.guid()+" "+hero.id +" "+ hero.typeID);
                    }
                    else{
                        ERROR("[DB]insertHero error "+self.guid()+" "+hero.id+" "+hero.typeid);
                    }
            }));
            playerManager.returnPlayerHeroList(self);
            cb(null, msg);
            //var pack = {hero: hero.getPackOption()};
            //mynet.sendSNewHero(self.getSession(), pack);
        }else{
            ERROR("add hero error");
        }
    }));

};



Player.prototype.initHeroList = function(result){
    this.heros = {}
    var one = null;
    for (var i in result){
        one = result[i];
        this.addHero(one);
    }
};

// just for sendback message
Player.prototype.getHeroList = function(){
    if(!this.heros){
        return null;
    }
    
    var heros = [], one = null, hero = null;
    for(var k in this.heros){
        one = this.heros[k];
        hero = one.getPackOption();
        heros.push(hero);
    }
    return heros;
};

Player.prototype.signIn = function(){
    this.signInCount++;
    this.lastSignInTime = timer.nowDate();

    this.updateDb(['last_signin_time', 'signin_count'], [this.lastSignInTime, this.signInCount]);
};

Player.prototype.recordSlotGamble = function(){
    this.lastGambleSlotTime = timer.nowDate();
    this.gambleSlotCount++;

    this.updateDb(['last_gamble_slot_time', 'gamble_slot_count'], [this.lastGambleSlotTime, this.gambleSlotCount]);
};

Player.prototype.recordFruitGamble = function(){
    this.lastGambleFruitTime = timer.nowDate();
    this.gambleFruitCount++;

    this.updateDb(['last_gamble_fruit_time', 'gamble_fruit_count'], [this.lastGambleFruitTime, this.gambleFruitCount]);
};

Player.prototype.clearTigerGamble = function(){
    this.gambleSlot1 = -1;
    this.gambleSlot2 = -1;
    this.gambleSlot3 = -1;

    this.updateDb(['gamble_slot1','gamble_slot2','gamble_slot3'],
                  [this.gambleSlot1,this.gambleSlot2,this.gambleSlot3]);
};

Player.prototype.recordSlotTigerGamble = function(id){
    if(this.gambleSlot1 == -1){
        this.gambleSlot1 = id;
        this.updateDb(['gamble_slot1'], [this.gambleSlot1]);
    }
    else if(this.gambleSlot2 == -1){
        this.gambleSlot2 = id;
        this.updateDb(['gamble_slot2'], [this.gambleSlot2]);
    }
    else if(this.gambleSlot3 == -1){
        this.gambleSlot3 = id;
        this.updateDb(['gamble_slot3'], [this.gambleSlot3]);
    }
    else{
        this.gambleSlot1 = id;
        this.gambleSlot2 = -1;
        this.gambleSlot3 = -1;

        this.updateDb(['gamble_slot1','gamble_slot2','gamble_slot3'],
                        [this.gambleSlot1,this.gambleSlot2,this.gambleSlot3]);
    }
};

Player.prototype.recordRecharge = function(money){
    this.rechargeTotal += money;
    this.updateDb(['recharge_total'], [this.rechargeTotal]);
};
/*
Player.prototype.addEquip = function(option){
    var baseInfo = equipInfoData[option.typeID]
    if(baseInfo){
        var inst = new Equip({owner: this,
                             id: option.id,
                             typeID: option.typeID,
                             heroID: option.heroID || -1,
                             baseInfo: baseInfo});
        this.equips[option.id] = inst;
        return inst;
    }
    else{
        return null;
    }
};

Player.prototype.initEquipList = function(result){
    this.equips = {}
    var one = null;
    for (var i in result){
        this.addEquip(result[i])
    }
};

// just for sendback message
Player.prototype.getEquipList = function(){
    if(!this.equips){
        return null;
    }

    var equips = [], one = null, equip = null;
    for(var k in this.equips){
        one = this.equips[k];
        equip = one.getPackOption();
        equips.push(equip);
    }
    return equips;
};

Player.prototype.getEquip = function(instID){
    return this.equips[instID];
};
*/

Player.prototype.onPointsChange = function(route,msg)
{
    msg.points = this.points();
    this.updateDb(['points'], [this.points()]);
    this.honorManager.updateSpecialHonor(define.SpecialHonor.Score, this.points());
    route.dispatch("master.player.offlineUpdatePlayer", {
        guid: this.guid(), points: this.points()
    });
    route.dispatch("global.rankingManager.changeRankingProperty", this.getRankingProperty());
};
Player.prototype.onLevelExpChange = function(route,msg)
{
    msg.exp = this.exp();
    msg.level = this.level();
    this.updateDb(['level', 'exp'], [this.level(), this.exp()]);
    this.honorManager.updateSpecialHonor(define.SpecialHonor.Level, this.level());
    route.dispatch("master.player.offlineUpdatePlayer", {
        guid: this.guid(), level: this.level()
    });
//    route.dispatch("global.rankingManager.changeRankingProperty", this.getRankingProperty());
};
Player.prototype.onPointsLevelExpChange = function(route,msg)
{
    msg.exp = this.exp();
    msg.level = this.level();
    msg.points = this.points();
    this.updateDb(['level', 'exp', 'points'], [this.level(), this.exp(), this.points()]);
    this.honorManager.updateSpecialHonor(define.SpecialHonor.Level, this.level());
    this.honorManager.updateSpecialHonor(define.SpecialHonor.Score, this.points());
    route.dispatch("master.player.offlineUpdatePlayer", {
        guid: this.guid(), level: this.level(), points: this.points()
    });
    route.dispatch("global.rankingManager.changeRankingProperty", this.getRankingProperty());
};

Player.prototype.RechargeDiamond = function(v, dummy)
{//v must greater than 0
    var msg = {};
    this.setDiamond(this.diamond() + v);

    if (this.getSession())
    {
        msg.diamond = this.diamond_all();
        mynet.sendPlayerInfoChange(this.getSession(), msg);
    }
    this.BILOG("diamond",{diff:v, diamond:this.diamond(),dummy:dummy});
};
Player.prototype.GiveDiamond = function(v, dummy)
{//v must greater than 0
    var msg = {};
    this.setDiamond_give(this.diamond_give() + v);

    if (this.getSession())
    {
        msg.diamond = this.diamond_all();
        mynet.sendPlayerInfoChange(this.getSession(), msg);
    }
    this.BILOG("diamond",{diff:v, diamond_give:this.diamond_give(),dummy:dummy});
};
Player.prototype.SubDiamond = function(m,dummy)
{//v must greater than 0; and litter than diamond_all
    var v = m;
    var msg = {};
    if (this.diamond() >= v)
    {
        this.setDiamond(this.diamond() - v);
        v = 0;
    }
    else
    {
        if (this.diamond() != 0)
        {
            v = v - this.diamond();
            this.setDiamond(0);
        }
        this.setDiamond_give(this.diamond_give() - v);
    }
    this.BILOG(dummy.action || "diamond_cost", {
        subAction: dummy.subAction,
        wptype: ""+dummy.actionType, wpid: ""+(dummy.storeId||1), wpnum: ""+(dummy.count||1),
        price: "" + m, sys_gold: v, recharge_gold: m - v,
        current_diamond: this.diamond_all()});
    this.getLuckyBox().triggerLucky(define.LuckyType.COST_DIAMOND, m);
    if (this.getSession())
    {
        msg.diamond = this.diamond_all();
        mynet.sendPlayerInfoChange(this.getSession(), msg);
    }
};

Player.prototype.changeAttr = function(option, msgForHonor){
    var route = container.getAttr("route");
    var levelRet = 0;
    var msg = {};
    if (option.exp)
    {
        levelRet = this.upLevel(option.exp);
        if (levelRet == 3)
        {
            /*
            this.setPointsRanK(this.level(), define.NOT_FULL_LEVEL_POINTS[3]);
            this.onPointsLevelExpChange(route,msg);
            */
            this.onLevelExpChange(route,msg);
            this.energyManager.afterLevelUpEnergy();
        }
        else if (levelRet == 2)
        {
            /*
            if (this.setPointsRanK(this.level(), option.points))
            {
                this.onPointsLevelExpChange(route,msg);
            }
            else
            {
                this.onLevelExpChange(route,msg);
            }
            */
            this.onLevelExpChange(route,msg);
            this.energyManager.afterLevelUpEnergy();
        }
        else if (levelRet == 1)
        {
            msg.exp = this.exp();
            this.updateDb(['exp'], [this.exp()]);
        }
    }
    if (option.energy)
    {
        this.setEnergy(this.energy()+option.energy);
        msg.energy = this.energy();
        this.BILOG("energy",{diff:option.energy, action: option.energy>0?"add":"subtract"});

        if (option.energyRecTime)
        {
            msg.energyRecTime = option.energyRecTime;
        }
    }

    if (option.battleCountBuyNum != undefined)
    {
        if(option.time != undefined){
            this.setBattleCount(this.battleCount() + option.battleCountBuyNum, option.time);
        } else {
            this.setBattleCount(this.battleCount() + option.battleCountBuyNum);
        }

        msg.battleCountBuyNum = this.battleCount();
    }

    if(option.rmb){
        this.setRMB(this.rmb()+option.rmb);
        this.honorManager.updateSpecialHonor(define.SpecialHonor.Rmb, option.rmb);

        msg.rmb = this.rmb();
    }
    if(option.gold){
        this.setGold(this.gold()+option.gold);

        if(option.gold < 0)
        {
            this.getLuckyBox().triggerLucky(define.LuckyType.COST_GOLD, 0 - option.gold);
        }
        this.getLuckyBox().triggerLucky(define.LuckyType.HOARD_GOLD, 0);
        msg.gold = this.gold();

        this.honorManager.updateSpecialHonor(define.SpecialHonor.Gold, option.gold, msgForHonor);
        this.BILOG("gold",{diff:option.gold, action: option.gold>0?"add":"subtract"});
    }
    if(option.lucky != undefined){
        this.setLucky(option.lucky);
        msg.lucky = option.lucky;
    }
    if(option.points)
    {
        if (this.setPointsRanK(this.level(), option.points))
        {
            this.onPointsChange(route,msg);
            msg.points = this.points();
        }
    }
    if(option.model){
        this.setModel(option.model);
        msg.model = this.getModel();
    }
    if (this.getSession()) {
        mynet.sendPlayerInfoChange(this.getSession(), msg);
    }
};


Player.masterChangeAttr = function(session, option){
    var player = playerManager.getPlayerById(option.playerId);
    if(!player)
    {
        return;
    }
    awardWrapper.giveAward(player,
        {
            awardType: option.reward.type,
            awardID: option.reward.baseId,
            awardCount: option.reward.count
        },
        {dummy: option.dummy});
};


Player.prototype.getRecord = function(k1, k2, k3){
    if(k2){
        if(!this.record[k1]){
            return null;
        }
        if(k3){
            if(!this.record[k1][k2]){
                return null;
            }
            return this.record[k1][k2][k3];
        }
        else{
            return this.record[k1][k2];
        }
    }
    else{
        return this.record[k1];
    }
};

Player.prototype.recordRecord = function(v, k1, k2, k3){
    if(k2){
        if(!this.record[k1]){
            this.record[k1] = {};
        }
        if(k3){
            if(!this.record[k1][k2]){
                this.record[k1][k2] = {};
            }
            this.record[k1][k2][k3] = v;
        }
        else{
            this.record[k1][k2] = v;
        }
    }
    else{
        this.record[k1] = v;
    }
    this.updateDb(['record'], ["'"+JSON.stringify(this.record)+"'"]);
};

/*
0: no change
1: add exp
2: add exp and level
3: add to full level
 */
Player.prototype.upLevel = function(exp){
    var self = this;
    var hero = self.heros[self.selctedHero];
    var nextLevelData = lvlInfomationData[self._level + 1];
    var currentLevelData = lvlInfomationData[self._level];

    if(!hero)
    {
        ERROR("get hero error, hero id = " + self.selctedHero + " player id = " + self._guid);
        return 0;
    }
    hero.levelUp(exp);

    if(currentLevelData == undefined)
    {//exp error
        LOG('player level error  : ' + self._guid);
    }
    else if (!nextLevelData)
    {//exp already full
    }
    else
    {
        self._exp += exp;
        if (self._exp >= currentLevelData.playerUpLvExp)
        {
            while (self._exp >= currentLevelData.playerUpLvExp)
            {
                nextLevelData = lvlInfomationData[self._level + 1];
                if(!nextLevelData)
                {//exp txt error
                    return 0;
                }
                self._level++;

                if (nextLevelData.playerUpLvExp == 0)
                {//exp full
                    self._exp = 0;
                    return 3;
                }
                self._exp -= currentLevelData.playerUpLvExp;
                currentLevelData = lvlInfomationData[self._level];
            }
            return 2;
        } else {
            return 1;
        }
    }
    return 0;
};




Player.prototype.changePlayerNick = function(nick, baseId, cb){
    var self = this;
    masterRemote.checkGlobalNick({name : nick, account : self.account(), playerId : self.guid()}, cbFunc(function(err, cbOption){
        if(err){
            if(err == "nameduplicate"){
                cb({player: true});
            }
            else{
                cb(null);
            }
        }else{
            self._charname = nick;
            self.updateDb(['charname'], ["'"+self.charname()+"'"]);
            cb({player:null});
        }
    }));

};


Player.prototype.checkGold = function(gold){
    var self = this;
    return self.gold() >= gold;
};
Player.prototype.checkDiamond = function(diamond){
    return this.diamond_all() >= diamond;
};


Player.prototype.getFightHeroMsg = function(){
    var self = this;
    var heroInfo = [];
    var hero = self.getHero(self.getSelctHero());
    if(!hero){
       LOG("not find hero , player " + self.guid());
       return [];
    }

    var heroSkillInfo = hero.getHeroSkillList();
    var skillList = heroSkillInfo.id;
    for (var i=0;i<skillList.length;i++)
    {
        heroInfo.push({baseId : 0, skillId : skillList[i], skillLv : 1, skillWeight: heroSkillInfo.weight[i],
            pos : i+1, skillType : Struct.S_PlayerBag.SkillType.SKILL});
    }

    var skillBaseId1 = -1, equipBaseId1 = -1;
    if(hero.equipPos1 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos1);
        //var skillInfo = EquipInfoData[equip.baseId];
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId1 = skillInfo.skill;
        equipBaseId1 = equip.baseId;
    }

    heroInfo.push({baseId : equipBaseId1, skillId : skillBaseId1, skillLv : 1, pos : 1,
                skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos1 });

    var skillBaseId2 = -1, equipBaseId2 = -1;
    if(hero.equipPos2 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos2);
        //var skillInfo = EquipInfoData[equip.baseId];
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId2 = skillInfo.skill;
        equipBaseId2 = equip.baseId

    }
    heroInfo.push({baseId : equipBaseId2, skillId : skillBaseId2, skillLv : 1, pos : 2,
        skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos2});


    var skillBaseId3 = -1, equipBaseId3 = -1;
    if(hero.equipPos3 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos3);
        //var skillInfo = EquipInfoData[equip.baseId];
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId3 = skillInfo.skill;
        equipBaseId3 = equip.baseId

    }
    heroInfo.push({baseId : equipBaseId3, skillId : skillBaseId3, skillLv : 1, pos : 3,
        skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos3});

    var skillBaseId4 = -1, equipBaseId4 = -1;
    if(hero.equipPos4 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos4);
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId4 = skillInfo.skill;
        equipBaseId4 = equip.baseId

    }
    heroInfo.push({baseId : equipBaseId4, skillId : skillBaseId4, skillLv : 1, pos : 4,
        skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos4});

    var skillBaseId5 = -1, equipBaseId5 = -1;
    if(hero.equipPos5 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos5);
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId5 = skillInfo.skill;
        equipBaseId5 = equip.baseId

    }
    heroInfo.push({baseId : equipBaseId5, skillId : skillBaseId5, skillLv : 1, pos : 5,
        skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos5});

    var skillBaseId6 = -1, equipBaseId6 = -1;
    if(hero.equipPos6 != -1){
        var equip = self.getItemBox().getEquipById(hero.equipPos6);
        var skillInfo = EquipInfoData[equip.baseInfo.typeID];
        skillBaseId6 = skillInfo.skill;
        equipBaseId6 = equip.baseId

    }
    heroInfo.push({baseId : equipBaseId6, skillId : skillBaseId6, skillLv : 1, pos : 6,
        skillType : Struct.S_PlayerBag.SkillType.EQUIP, dbId : hero.equipPos6});

    return heroInfo;
};

Player.prototype.getRankingProperty = function(){
    return {playerId : this.guid(),
        level : this.level(),
        nick : this.charname(),
        points : this.points(),
        fightCount : this.honorManager.getPvpAllTimes(),
        winCount : this.honorManager.getPvpSuccessTimes(),
        fightTime : this.honorManager.pvpDay,
        model : this.getModel()};
};

Player.prototype.setPointsRanK = function(level, points){
    var p = this.points();

//    if (level > define.NOT_FULL_LEVEL3)
//    {
        var rank = selectRank(points);
        if (!rank)
        {
            ERROR("setPointsRanK points = " + points);
            return;
        }
        this._points = points;
        this._rank = rank.id;
    /*
    }
    else if (level > define.NOT_FULL_LEVEL2)
    {
        this._points = define.NOT_FULL_LEVEL_POINTS[2];
        this._rank = 0;
    }
    else if (level > define.NOT_FULL_LEVEL1)
    {
        this._points = define.NOT_FULL_LEVEL_POINTS[1];
        this._rank = 0;
    }
    else
    {
        this._points = define.NOT_FULL_LEVEL_POINTS[0];
        this._rank = 0;
    }
    */

    if (p == this.points())
    {
        return false;
    }
    else
    {
        return true;
    }
};

Player.prototype.calMoney = function(monetaryType, marketPrice, count){
    var option = null;
    var money = define.getMoneyNum(this, monetaryType);
    if (money)
    {
        var price = marketPrice * count;
        if (price <= money)
        {
            option = {};
            switch (define.getMoneyType(monetaryType))
            {
                case define.CURRENCY.RMB:
                    option.rmb = price * -1;
                    break;
                case define.CURRENCY.GOLD:
                    option.gold = price * -1;
                    break;
                case define.CURRENCY.DIAMOND:
                    option.diamond = price;
                    break;
                case define.CURRENCY.EXP:
                    option.exp = price * -1;
                    break;
                default:
                    option = null;
                    break;
            }
        }
    }
    return option;
};

Player.prototype.getAllGoods = function()
{
    var self = this;
    masterRemote.getAllGoods({type:marketMsg.getShopType()}, cbFunc(function(err, result){
        if (err)
        {
            ERROR('getAllGoods : ' + err);
        }
        else
        {
            self.propMarket = {};
            for (var i= 0;i<result.length;i++)
            {
                var item = result[i];
                if (item.goodsType == define.ItemType.PROPS)// && item.pagination == 4 && item.count == 1)
                {
                    var prop = {};
                    prop.storeId = item.storeId;
                    prop.monetaryType = item.monetaryType;
                    prop.marketPrice = item.marketPrice;
                    prop.count = item.count;
                    prop.goodsName = item.goodsName;
                    prop.goodsType = item.goodsType;
                    prop.goodsId = item.goodsId;
                    self.propMarket[item.storeId] = prop;
                }
            }
            mynet.sendGetGoodsList_RET(self.getSession(), result);
        }
    }));
};

Player.prototype.buyGoods = function(option, cb)
{
    var self = this;
    masterRemote.buyGoods({id : option.storeId, type : option.shopType}, cbFunc(function(err, result){
        if (err)
        {
            LOG('buyProps: error ' + self.guid() + ' storeId =  ' + option.storeId);
            cb({status: mynet.getBuyGoodsFail()});
            return;
        }
        if (option.option.diamond > 0)
        {
            self.SubDiamond(option.option.diamond, {action:"buygoods",
                subAction: option.dummy,
                actionType:result.data.goodsType,
                storeId:result.data.storeId,
                count:option.count});
        }
        else
        {
            self.changeAttr(option.option);
        }
        if( result.data.goodsType == define.GoodsType.HERO )
        {
            playerManager.addHero(self.guid(), {id: result.data.heroid, typeID: result.data.goodsId}, cbFunc(function(flag){
                if(flag){
                    cb({status : mynet.getBuyGoodsSucc()});
                } else {
                    cb({status: mynet.getBuyGoodsFail()});
                }
            }));
        }
        else
        {
            self.getItemBox().addItemByPush({itemId : result.data.goodsId, type:result.data.goodsType, count : option.count});
            cb({status : mynet.getBuyGoodsSucc()});
        }
    }));
};

/*
Player.prototype.checkBuyPveGoods = function(storeId, count)
{
    var prop = this.propMarket[storeId];
    if (!prop)
    {
        return false;
    }
    var option = this.calMoney(prop.monetaryType, prop.marketPrice, count);
    if (!option)
    {
        return false;
    }
    return true;
};
*/

Player.prototype.buyPveGoods = function(storeId, count)
{
    var prop = this.propMarket[storeId];
    if (prop)
    {
        var option = this.calMoney(prop.monetaryType, prop.marketPrice, count);
        if (option)
        {
            if (option.diamond > 0)
            {
                this.SubDiamond(option.diamond, {action:"buygoods",
                    subAction:"buyPveGoods",
                    actionType:prop.goodsType,
                    storeId:prop.storeId,
                    count:count});
            }
            else
            {
                this.changeAttr(option);
            }
        }
    }
};

Player.prototype.getFightAdditionAttri = function()
{
    var ret = [];
    ret.push(this.getLuckyBox().luckyGold());
    ret.push(this.getLuckyBox().luckyHighDamage());
    this.getTalentBox().fightAdditionAttri(ret);
    this.getHero(this.getSelctHero()).fightAdditionAttri(ret);
    return ret;
};

Player.prototype.BILOG = function(action, dummy){
    var conf = require("../../config");
    BILOG({
        account: this.account(),
        playerid: this.guid(),
        level: this.level(),
        action: action,
        serverid: conf.WORLD_ID,
        device_id: this.device_id,
        store: this.store,
        dummy: dummy
    });
};
