'use strict'
const axios = require('axios').default;
const fs = require("fs");
const Database = use('Database')
const moment = require('moment');
const Mobiair = use('App/Models/Mobiair')
const Location = use('App/Models/Location')
const Device = use('App/Models/Device')
const domain = 'https://airpointer-2021-00745.recordum.net'
const excelJS = require("exceljs");
const Helpers = use('Helpers')
const { exec } = require('child_process')

class AirpointerController {

  async TesData ({response}) {
    try {
      var logs = fs.readFileSync('./public/logs/logs.txt', 'utf8');
          exec('sh public/createfolder.sh', (err, stdout, stderr) => {
            console.log('run');
            if (!err) {
              console.log(stdout);
              return fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() + ' : successfully generated' +"\n"+ stdout  + "==================================================")
            }else{
              console.log(err);
              fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() +" : "+ err.message)
            }
          });
          
      } catch (e) {
        console.log(e);
          fs.writeFileSync("./public/logs/logs.txt",logs +"\n"+ moment() +" : "+ e.message)
          // createfile();
      }
  }
  cv(x,bm){
    var val = null
    switch (bm) {
      case 'NO2':
        val = (46.01 * x / 24.45).toFixed(1)
        break;
      case 'O3':
        val = (48.00 * x / 24.45).toFixed(1)
        break;
      case 'SO2':
        val = (64.06 * x / 24.45).toFixed(1)
        break;
      case 'CO':
        val = (28.01 * x / 24.45 * 1000).toFixed(1)
        break;
      default:
        val = null;
    }
    if (val != null) {
      return val
    }
  }
  
  async saveimg({response,request}){
    const {names} = request.all();
    try {
      const img = request.file('img',{
        types: ['image'],
        size: '2mb'
      });
      if (img) {
        const dir = Helpers.publicPath(`snapshots/${moment().format('DDMMYY')}`)
        console.log(dir);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        var file = fs.readFileSync(img.tmpPath);
        fs.writeFileSync(`${dir}/${names}.${img.extname}`, file);
        return response.json({status: 'success'});
      }
    } catch (error) {
      return console.log(error.message);
    }
  }

  async pushData({request, response}){
    const {img} = request.all();
    // const {start,end} = request.all();
    const data = new Mobiair()
    var start = moment().subtract(4, 'minutes').format('YYYY-MM-DD,HH:mm');
    var end = moment().subtract(2, 'minutes').format('YYYY-MM-DD,HH:mm');
    const req = await axios.get(`${domain}/cgi-bin/download.cgi?loginstring=admin&user_pw=1AQuality&tstart=${start}&tend=${end}&avg1=1,2,3,4,5,6,31,11913,11925,11883,11884,11877,11878,11889,11890,11895,11937,11931,11919,11943&type=json&header_name`);
    
    const gmtDevice = await Database.from('devices')
    const gmtLoc = await Database.from('locations').where('start_date', '<=', moment().format('YYYY-MM-DD HH:mm')).where('end_date', '>=', moment().format('YYYY-MM-DD HH:mm'))
    
    var a = [], b = [], c = [], d = []
    for (const i of req.data[1]['airpointer_data']) {
      for (const iterator of i['parameter']) {
        if (iterator.value == 9999 ||iterator.value == -9999) {
          b.push(null)
          c.push(iterator.name)
        }else{
          var x =  null
          if (iterator.name == 'NO2'||iterator.name == 'O3'||iterator.name == 'SO2'||iterator.name == 'CO' ||iterator.name == 'PM2.5'||iterator.name == 'PM10') {
            x = this.cv(iterator.value,iterator.name)
            c.push(iterator.name)
            c.push(`${iterator.name}_cv`)

            b.push(iterator.value)
            b.push(parseFloat(x))
          }else{
            b.push(iterator.value)
            c.push(iterator.name)
          } 
        }
      }
      a.push(b)
      d.push(c)
      b = []
      c = []
    }
    var choosetime = [], polutant = [], polutant_v = []
    for (const u of a) {
      var map = u.reduce((cnt, cur) => (cnt[cur] = cnt[cur] + 1 || 1, cnt), {});
      choosetime.push(map.null)
    }
    var min = Math.min(...choosetime);
    isNaN(min) ? min = choosetime.length - 1 : min = choosetime.indexOf(min)
    var ispu = [[a[min][2],'NO2'], [a[min][5],'CO'], [a[min][7],'O3'], [a[min][9],'SO2'], [a[min][15],'PM2.5']];
    var cp_v = [],highIspuConst = []
    
    for (const is of ispu) {
      var temp = await HitungIspu(is)
      highIspuConst.push(temp[1])
      cp_v.push(is[0])
      polutant.push(temp[0]);
      polutant_v.push(`${is[1]}`);
      a[min].push(temp[0] > 0 ? temp[0] : null )
      d[min].push(`ispu_${is[1]}`)
      temp = []
    }
    const resultMobiair = JSON.parse(highIspuConst[polutant.indexOf(`${Math.max(...polutant)}`)].ispu_desc) 
    // const ispuConst = await Database.from('ispu_const');
    
    var timedata = moment(`${req.data[1]['airpointer_data'][2].date_time}`)
    const gmtp = timedata.subtract(moment.duration(`${gmtDevice[0].default_gmt}:00:00`)).format('YYYY-MM-DD HH:mm')
    if((moment().hour() == 9 && moment().minutes()<=6) || (moment().hour() == 15 && moment().minutes()<=6)) {
      data.ispu_status = moment().hour()
    }else if(moment().minutes()<=6){
      data.ispu_status = 'H'
    }

    d[min].push(`ispu_datetime_gmt_plus`)
    a[min].push(moment().subtract(2, 'minutes').format('YYYY-MM-DD,HH:mm'))
    data.image = img
    data.ispu_color = `[${resultMobiair['color']}]`
    data.ispu_desc = `[${resultMobiair['desc']}]`
    data.device_id = gmtLoc[0].device_id
    data.location = gmtLoc[0].loc_abbr
    data.gmt_plus = gmtLoc[0].gmt_plus
    data.ispu_datetime_gmt =  moment().subtract(gmtDevice[0].default_gmt, 'hours').format('YYYY-MM-DD,HH:mm')
    data.pm25rt_value = a[min][d[min].indexOf('ConcRT_all')]
    data.r_hum = a[min][d[min].indexOf('RH')]
    data.ispu_datetime_gmt_plus =  moment(new Date(gmtp)).add(gmtLoc[0].gmt_plus,'hours').format('YYYY-MM-DD HH:mm');
    data.ispu_value = Math.max(...polutant)
    data.critical_pollutant = polutant_v[polutant.indexOf(`${Math.max(...polutant)}`)]
    data.dev_status = a[min][d[min].indexOf('Status')]
    data.cp_value = cp_v[polutant.indexOf(`${Math.max(...polutant)}`)]
    data.no_value = a[min][d[min].indexOf('NO')]
    data.no2_value = a[min][d[min].indexOf('NO2')] 
    data.no2_cv = a[min][d[min].indexOf('NO')]
    data.nox_value = a[min][d[min].indexOf('NOX')]
    data.co_value = a[min][d[min].indexOf('CO')]
    data.co_cv = a[min][d[min].indexOf('CO')]
    data.o3_value = a[min][d[min].indexOf('O3')]
    data.o3_cv = a[min][d[min].indexOf('O3_cv')]
    data.so2_value = a[min][d[min].indexOf('SO2')]
    data.so2_cv = a[min][d[min].indexOf('SO2_cv')]
    data.cool_temp = a[min][d[min].indexOf('CoolTemp')]
    data.ambient_temp = a[min][d[min].indexOf('AT')]
    data.barometric_p = a[min][d[min].indexOf('BP')]
    data.flow = a[min][d[min].indexOf('Flow')] = null ? null : a[min][d[min].indexOf('Flow')].toFixed(1)
    data.frh = a[min][d[min].indexOf('FRH')] = null ? null : a[min][d[min].indexOf('FRH')].toFixed(1)
    data.ft = a[min][d[min].indexOf('FT')] = null ? null : a[min][d[min].indexOf('FT')].toFixed(1)
    data.ispu_no2 = a[min][d[min].indexOf('ispu_NO2')]
    data.ispu_co = a[min][d[min].indexOf('ispu_CO')] 
    data.ispu_o3  = a[min][d[min].indexOf('ispu_O3')]  
    data.ispu_so2 = a[min][d[min].indexOf('ispu_SO2')] 
    data.ispu_pm25rt = a[min][d[min].indexOf('ispu_PM2.5')] 
    data.save();
    return response.json({data:a[min],keterangan:d[min],total_keterangan:d[min].length,total_data:a[min].length});
  }

  async Location({request, response}){
    const { device_id, loc_abbr,loc_addr,lat,lng,start_date,end_date,gmt_plus} = request.all()
    if(device_id == undefined || loc_abbr == undefined|| loc_addr == undefined || lat == undefined || lng == undefined || start_date == undefined || end_date == undefined || gmt_plus == undefined){
      return response.json({data:'failed'});
    }else{
      const data = new Location()
      data.device_id = device_id
      data.loc_abbr = loc_abbr
      data.loc_addr = loc_addr
      data.lat = lat
      data.lng = lng
      data.start_date = start_date
      data.end_date = end_date
      data.gmt_plus = gmt_plus
      await data.save()
      return response.json({data: 'success'});
    }
  }

  async device({request, response}){
    const { device_id, default_gmt} = request.all()
    if(device_id == undefined || default_gmt == undefined){
      return response.status(400).send({data:'failed'});
    }else{
      await Database.table('devices').insert({device_id: device_id,default_gmt:default_gmt})
      return response.json({data: 'success'});
    }
  }

  async getDevice({response}){
    try {
      const data = await await Database.from('devices')
      return response.json({status:'success',data: data[0]});
    } catch (error) {
      return response.status(400).send({data:error});
    }
  }
  
  async getLocations({params,response}){
    const data = await await Database.from('locations').select('device_id','loc_abbr','loc_addr','lat','lng','start_date','end_date').where({'device_id' : params.id}).limit(1)
    return response.json({status:'success',data: data[0]});
  }

  async getData({response,params}){
    var hours12 = [], PM1 = [], PM25 = [], PM10 = [], O3 = [], NO2 = [], CO = [], SO2 = [], AT = [], CT = [], RH = [], BP = [], Flow = [], FRH = [], FT = [],unit = [],baku_mutu = [],param = [],params_string = []
    const ispu_const = ['SO2','PM2.5','PM10','O3','NO2','CO']
    const ispu_constv = ['so2_value','pm25rt_value','o3_value','no2_value','NO2','co_value']
    const data = await Database.from('mobiair_raw').where({'device_id' : params.id}).orderBy('id', 'desc').limit(1)
    if (data.length > 0) {
      const units = await Database.from('units')
      const ispu9or15 = await Database.raw(`SELECT * FROM mobiair_raw WHERE device_id = "${params.id}"  and ispu_status = 15 OR ispu_status = 9 ORDER BY id desc LIMIT 1`);
      if (ispu9or15.length > 0) {
        const ispu12hours = await Database.from('mobiair_raw').where({ispu_status: 'H'}).where({'device_id' : params.id}).orderBy('id', 'desc').limit(12)
        const locs =  await Database.raw('SELECT loc_abbr,loc_addr,lat,lng,start_date,end_date FROM locations WHERE DATE_FORMAT(start_date, "%Y-%m-%d") <= DATE_FORMAT(now(), "%Y-%m-%d") AND DATE_FORMAT(end_date, "%Y-%m-%d") >= DATE_FORMAT(now(), "%Y-%m-%d") limit 1');
        for (const u of units) {
          param.push(u.param)
          baku_mutu.push(u.baku_mutu)
          unit.push(u.unit) 
          params_string.push(u.param_string)
        }
        
        for (const iterator of ispu12hours) {
          hours12.push(
            {
              ispu_datetime_gmt_plus: moment(iterator.ispu_datetime_gmt_plus).format('llll'),
              ispu_value: iterator.ispu_value,
              critical_pollutant: {
                critical_pollutant:iterator.critical_pollutant,
                cp_value:iterator.cp_value,
                unit:unit[param.indexOf(ispu_constv[ispu_const.indexOf(iterator.critical_pollutant)])]
              },
              ispu_description:(iterator.ispu_desc.substr(1,iterator.ispu_desc.length-2)).split(','),
              ispu_color:(iterator.ispu_color.substr(1,iterator.ispu_color.length-2)).split(','),
            }        
          )
          AT.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.ambient_temp,
            unit:unit[param.indexOf('ambient_temp')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          CT.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.cool_temp,
            unit:unit[param.indexOf('cool_temp')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          RH.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.r_hum,
            unit:unit[param.indexOf('r_hum')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          BP.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.barometric_p,
            unit:unit[param.indexOf('barometric_p')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          Flow.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.flow,
            unit:unit[param.indexOf('flow')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          FRH.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.frh,
            unit:unit[param.indexOf('frh')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          FT.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            value:iterator.ft,
            unit:unit[param.indexOf('ft')],
            // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          PM1.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_pm1rt,
            value:iterator.pm1rt_value,
            cv:iterator.pm1rt_value,
            unit:'μg/m3',
            unit_cv:'μg/m3',
            color:iterator.pm1rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          PM25.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_pm25rt,
            value:iterator.pm25rt_value,
            cv:iterator.pm25rt_value,
            unit:unit[param.indexOf('pm25rt_value')],
            unit_cv:unit[param.indexOf('pm25rt_value')],
            color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm25rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          PM10.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_pm10rt,
            value:iterator.pm1rt_value,
            cv:iterator.pm1rt_value,
            unit:'μg/m3',
            unit_cv:'μg/m3',
            color:iterator.pm10rt_value > baku_mutu[param.indexOf('pm10rt_value')] ? '#FF6B6B' : '#BDD0FB'
          })
          NO2.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_no2,
            value:iterator.no2_value,
            cv:iterator.no2_cv,
            unit:unit[param.indexOf('no2_value')],
            unit_cv:unit[param.indexOf('no2_cv')],
            color:iterator.no2_cv > baku_mutu[param.indexOf('no2_cv')] ? '#FF6B6B' : '#BDD0FB'
          })
          O3.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_o3,
            value:iterator.o3_value,
            cv:iterator.o3_cv,
            unit:unit[param.indexOf('o3_value')],
            unit_cv:unit[param.indexOf('o3_cv')],
            color:iterator.o3_cv > baku_mutu[param.indexOf('o3_cv')] ? '#FF6B6B' : '#BDD0FB'
          })
          CO.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_co,
            value:iterator.co_value,
            cv:iterator.co_cv,
            unit:unit[param.indexOf('co_value')],
            unit_cv:unit[param.indexOf('co_cv')],
            color:iterator.co_cv > baku_mutu[param.indexOf('co_cv')] ? '#FF6B6B' : '#BDD0FB'
          })
          SO2.push({
            ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
            ispu:iterator.ispu_so2,
            value:iterator.so2_value,
            cv:iterator.so2_cv,
            unit:unit[param.indexOf('so2_value')],
            unit_cv:unit[param.indexOf('so2_cv')],
            color:iterator.so2_cv > baku_mutu[param.indexOf('so2_cv')] ? '#FF6B6B' : '#BDD0FB'
          })
        }
        const concentration = [
          {
            parameter:"PM1",
            isview:1,
            data:PM1,
          },
          {
            parameter:params_string[param.indexOf('pm25rt_value')],
            isview:1,
            data:PM25,
          },
          {
            parameter:"PM10",
            isview:1,
            data:PM10,
          },
          {
            parameter:params_string[param.indexOf('no2_value')],
            isview:1,
            data:NO2,
          },
          {
            parameter:params_string[param.indexOf('so2_value')],
            isview:1,
            data:SO2,
          },
          {
            parameter:params_string[param.indexOf('o3_value')],
            isview:1,
            data:O3,
          },
          {
            parameter:params_string[param.indexOf('co_value')],
            isview:1,
            data:CO,
          },
          {
            parameter:params_string[param.indexOf('ambient_temp')],
            isview:1,
            data:AT,
          },
          {
            parameter:params_string[param.indexOf('cool_temp')],
            isview:0,
            data:CT,
          },
          {
            parameter:params_string[param.indexOf('r_hum')],
            isview:1,
            data:RH,
          },
          {
            parameter:params_string[param.indexOf('barometric_p')],
            isview:1,
            data:BP,
          },
          {
            parameter:params_string[param.indexOf('flow')],
            isview:0,
            data:Flow,
          },
          {
            parameter:params_string[param.indexOf('frh')],
            isview:0,
            data:FRH,
          },
          {
            parameter:params_string[param.indexOf('ft')],
            isview:0,
            data:FT,
          }
        ]
        const header = {
          cool_temp: data[0].cool_temp,
          ft:data[0].ft,
          frh:data[0].frh,
          flow:data[0].flow,
          airpointer_status:{
            color:moment(data[0].ispu_datetime_gmt_plus) < moment().subtract(24, 'hours') ? '#ff0000' : '#30D158',
            last_data: `Last data ${moment(data[0].ispu_datetime_gmt_plus).fromNow()}`
          },
          met_one:{
            color:moment(ispu9or15[0].ispu_datetime_gmt_plus) < moment().subtract(24, 'hours') ? '#ff0000' : '#30D158',
            last_data: `Last data ${moment(data[0].ispu_datetime_gmt_plus).fromNow()}`
          },
          current_location:{
            address:locs[0][0].loc_addr,
            abbrevation:locs[0][0].loc_abbr,
            point:`${locs[0][0].lat},${locs[0][0].lng}`,
            start:moment(locs[0][0].start_date).format('llll'),
            end:moment(locs[0][0].end_date).format('llll'),        
          },
          ispu:{
            ispu_datetime_gmt_plus: moment(ispu9or15[0][0].ispu_datetime_gmt_plus).format('llll'),
            ispu_value:ispu9or15[0][0].ispu_value,
            critical_pollutant:{
              critical_pollutant:ispu9or15[0][0].critical_pollutant,
              cp_value:ispu9or15[0][0].cp_value,
              unit:unit[param.indexOf(ispu_constv[ispu_const.indexOf(ispu9or15[0][0].critical_pollutant)])]
            },
            ispu_description:(ispu9or15[0][0].ispu_desc.substr(1,ispu9or15[0][0].ispu_desc.length-2)).split(','),
            ispu_color:(ispu9or15[0][0].ispu_color.substr(1,ispu9or15[0][0].ispu_color.length-2)).split(','),
          },
        }
        
        const detail = {
          ispu_last_12h:hours12,
          concentration: concentration
        }

        const json = {
          status: 'success',
          header:header,
          detail:detail,
        }
        return response.json(json);
      }
    }else{
      return response.status(400).send({status:'error',data:[],message:'data not available'})
    }
    
  }

  async getDataRewind({params,response}){
    var unit = [],baku_mutu = [],param = []
    var  PM1 = [], PM25 = [], PM10 = [], O3 = [], NO2 = [], CO = [], SO2 = [], AT = [], CT = [], RH = [], BP = [], Flow = [], FRH = [], FT = [], IMG = []
    const units = await Database.from('units')
    const data = await Database.raw(`SELECT * FROM mobiair_raw WHERE DATE_FORMAT(ispu_datetime_gmt_plus, "%Y-%m-%d") = '${params.tgl}' AND device_id = '${params.id}'`);
    if (data[0].length > 0) {
      for (const u of units) {
        param.push(u.param)
        baku_mutu.push(u.baku_mutu)
        unit.push(u.unit) 
      }
      for (const iterator of data[0]) {
        IMG.push({
          image:iterator.image,
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('h:mm a')
        })
        AT.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.ambient_temp,
          unit:unit[param.indexOf('ambient_temp')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        CT.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.cool_temp,
          unit:unit[param.indexOf('cool_temp')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        RH.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.r_hum,
          unit:unit[param.indexOf('r_hum')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        BP.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.barometric_p,
          unit:unit[param.indexOf('barometric_p')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        Flow.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.flow,
          unit:unit[param.indexOf('flow')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        FRH.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.frh,
          unit:unit[param.indexOf('frh')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        FT.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          value:iterator.ft,
          unit:unit[param.indexOf('ft')],
          // color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        PM1.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_pm1rt,
          value:iterator.pm1rt_value,
          cv:iterator.pm1rt_value,
          unit:'μg/m3',
          unit_cv:'μg/m3',
          color:iterator.pm1rt_value > baku_mutu[param.indexOf('pm1rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        PM25.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_pm25rt,
          value:iterator.pm25rt_value,
          cv:iterator.pm25rt_value,
          unit:unit[param.indexOf('pm25rt_value')],
          unit_cv:unit[param.indexOf('pm25rt_value')],
          color:iterator.pm25rt_value > baku_mutu[param.indexOf('pm25rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        PM10.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_pm10rt,
          value:iterator.pm1rt_value,
          cv:iterator.pm1rt_value,
          unit:'μg/m3',
          unit_cv:'μg/m3',
          color:iterator.pm10rt_value > baku_mutu[param.indexOf('pm10rt_value')] ? '#FF6B6B' : '#BDD0FB'
        })
        NO2.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_no2,
          value:iterator.no2_value,
          cv:iterator.no2_cv,
          unit:unit[param.indexOf('no2_value')],
          unit_cv:unit[param.indexOf('no2_cv')],
          color:iterator.no2_cv > baku_mutu[param.indexOf('no2_cv')] ? '#FF6B6B' : '#BDD0FB'
        })
        O3.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_o3,
          value:iterator.o3_value,
          cv:iterator.o3_cv,
          unit:unit[param.indexOf('o3_value')],
          unit_cv:unit[param.indexOf('o3_cv')],
          color:iterator.o3_cv > baku_mutu[param.indexOf('o3_cv')] ? '#FF6B6B' : '#BDD0FB'
        })
        CO.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_co,
          value:iterator.co_value,
          cv:iterator.co_cv,
          unit:unit[param.indexOf('co_value')],
          unit_cv:unit[param.indexOf('co_cv')],
          color:iterator.co_cv > baku_mutu[param.indexOf('co_cv')] ? '#FF6B6B' : '#BDD0FB'
        })
        SO2.push({
          ispu_datetime_gmt_plus:moment(iterator.ispu_datetime_gmt_plus).format('llll'),
          ispu:iterator.ispu_so2,
          value:iterator.so2_value,
          cv:iterator.so2_cv,
          unit:unit[param.indexOf('so2_value')],
          unit_cv:unit[param.indexOf('so2_cv')],
          color:iterator.so2_cv > baku_mutu[param.indexOf('so2_cv')] ? '#FF6B6B' : '#BDD0FB'
        })
      }
      const concentration = [
        {
          parameter:"PM1",
          isview:1,
          data:PM1,
        },
        {
          parameter:"PM2.5",
          isview:1,
          data:PM25,
        },
        {
          parameter:"PM10",
          isview:1,
          data:PM10,
        },
        {
          parameter:"NO2",
          isview:1,
          data:NO2,
        },
        {
          parameter:"SO2",
          isview:1,
          data:SO2,
        },
        {
          parameter:"O3",
          isview:1,
          data:O3,
        },
        {
          parameter:"CO",
          isview:1,
          data:CO,
        },
        {
          parameter:"ambient_temp",
          isview:1,
          data:AT,
        },
        {
          parameter:"cool_temp",
          isview:0,
          data:CT,
        },
        {
          parameter:"RH",
          isview:0,
          data:RH,
        },
        {
          parameter:"BP",
          isview:1,
          data:BP,
        },
        {
          parameter:"FLOW",
          isview:0,
          data:Flow,
        },
        {
          parameter:"FRH",
          isview:0,
          data:FRH,
        },
        {
          parameter:"FT",
          isview:0,
          data:FT,
        },
        {
          parameter:"image",
          isview:0,
          data:IMG,
        }
      ]
      const json = {
        status: 'success',
        data:concentration,
        message: `${data[0].length} row data`
      }
      return response.json(json);
    } else {
      return response.status(400).send({status:'error',data:[],message:'data not available'})
    }
    
  }

  async AirpointerData({view}){
    const data = await Mobiair.all();
    return view.render('airpointer', { posts: data.rows })
  }

  async CreateReport({params,response}){
    const data0903 = await Database.raw(`SELECT * FROM mobiair_raw WHERE DATE_FORMAT(ispu_datetime_gmt_plus, "%Y-%m-%d") = '${params.tgl}' AND ispu_status IN (9,15) and device_id = '${params.id}'` );
    if (data0903.length > 0) {
      const locs =  await Database.raw('SELECT * FROM locations WHERE DATE_FORMAT(start_date, "%Y-%m-%d") <= DATE_FORMAT(now(), "%Y-%m-%d") AND DATE_FORMAT(end_date, "%Y-%m-%d") >= DATE_FORMAT(now(), "%Y-%m-%d") limit 1');
      const dataAll = await Database.raw(`SELECT * FROM mobiair_raw WHERE DATE_FORMAT(ispu_datetime_gmt_plus, "%Y-%m-%d") = '${params.tgl}' AND ispu_status IN ('H',9,15) and device_id = '${params.id}'` );
        var a = [],b=[],c=[],d=[],pm25=[],pm10=[],so2=[],no2=[],co=[],o3=[],hc=[],minmax=[]
        for (const iterator of dataAll[0]) {
          pm25.push(iterator.pm25rt_value)
          pm10.push(iterator.pm10rt_value)
          so2.push(iterator.so2_value)
          no2.push(iterator.no2rt_value)
          co.push(iterator.co_value)
          o3.push(iterator.o3_value)
          hc.push(null)
          b.push(moment(iterator.ispu_datetime_gmt_plus).format('llll'),iterator.pm25rt_value,iterator.pm10rt_value,iterator.so2_value,iterator.no2_value,iterator.co_value,iterator.o3_value,1)
          a.push(b)
          b = []
        }
        
        for (const iterator of data0903[0]) {
          d.push(moment(iterator.ispu_datetime_gmt_plus).format('lll'),iterator.critical_pollutant,iterator.ispu_value,iterator.ispu_desc,(moment(iterator.ispu_datetime_gmt_plus).subtract(24,'Hours').format('LLL')),moment(iterator.ispu_datetime_gmt_plus).format('LLL'))
          c.push(d)
          d = []
        }

        const json = {
          data:a,
          conc:{
            max:['Max',getMax(pm25),getMax(pm10),getMax(so2),getMax(no2),getMax(co),getMax(o3),getMax(hc)],
            min:['Min',getMin(pm25),getMin(pm10),getMin(so2),getMin(no2),getMin(co),getMin(o3),getMin(hc)],
            mean:['Mean',Number(getMean(pm25)),Number(getMean(pm10)),Number(getMean(so2)),Number(getMean(no2)),Number(getMean(co)),Number(getMean(o3)),Number(getMean(hc))]
          }
        }
        const workbook = new excelJS.Workbook();  // Create a new workbook
        const worksheet = workbook.addWorksheet("Mobiair"); 
        worksheet.getCell(`B1`).value = `MobiAir Device ID:`;
        worksheet.getCell(`B2`).value = `Device GMT:`;
        worksheet.getCell(`B3`).value = `Location:`;
        worksheet.getCell(`B4`).value = `Address:`;
        worksheet.getCell(`B5`).value = `Assignment Period:`;
        worksheet.getCell(`G1`).value = `Date Created:`;
        worksheet.getCell(`C1`).value = `${locs[0][0].device_id}`;
        worksheet.getCell(`C2`).value = `${dataAll[0][0].gmt_plus}`;
        worksheet.getCell(`C3`).value = `${dataAll[0][0].location}`;
        worksheet.getCell(`C4`).value = `${locs[0][0].loc_addr}`;
        worksheet.getCell(`C5`).value = `${locs[0][0].start_date} - ${locs[0][0].end_date}`;
        worksheet.getCell(`H1`).value = `${moment().format('lll')}`;
        worksheet.getCell('B1').font = { bold: true };
        worksheet.getCell('B2').font = { bold: true };
        worksheet.getCell('B3').font = { bold: true };
        worksheet.getCell('B4').font = { bold: true };
        worksheet.getCell('B5').font = { bold: true };
        worksheet.getCell('G1').font = { bold: true };

        worksheet.getCell(`B7`).value = `ISPU per Hour`;
        const path = "./public/report"; 
        worksheet.columns = [
          { width: 5 }, 
          { width: 30 }, 
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
          { width: 15 },
        ];
        
        minmax.push(json.conc.min)
        minmax.push(json.conc.mean)
        minmax.push(json.conc.max)
        worksheet.getCell(`B${a.length + 22}`).value = 'ISPU 24 Hour (9:00 AM & 03:00 PM)';
        worksheet.addTable({
          name: 'Mobiair',
          ref: 'B8',
          headerRow: true,
          // totalsRow: true,
          style: {
            theme: 'TableStyleMedium2',
            // showRowStripes: true,
          },
          columns: [
            {name: 'Waktu', },
            {name: 'PM2.5(ug/m3)',},
            {name: 'PM10(ug/m3)', },
            {name: 'SO2(ug/m3)',},
            {name: 'NO2(ug/m3)', },
            {name: 'CO(ug/m3)',},
            {name: 'O3(ug/m3)', },
            {name: 'HC(ug/m3)',},
          ],
          rows: a
        });
        worksheet.addTable({
          name: 'MyTable2',
          ref: `B${a.length + 10}`,
          headerRow: true,
          // totalsRow: true,
          style: {
            theme: 'TableStyleMedium2',
            // showRowStripes: true,
          },
          columns: [
            {name: 'Parameter', },
            {name: 'PM2.5(ug/m3)',},
            {name: 'PM10(ug/m3)', },
            {name: 'SO2(ug/m3)',},
            {name: 'NO2(ug/m3)', },
            {name: 'CO(ug/m3)',},
            {name: 'O3(ug/m3)', },
            {name: 'HC(ug/m3)',},
          ],
          rows: minmax
        });
        worksheet.addTable({
          name: 'MyTable',
          ref: `B${a.length + 15}`,
          headerRow: true,
          // totalsRow: true,
          style: {
            theme: 'TableStyleMedium2',
            // showRowStripes: true,
          },
          columns: [
            {name: 'Skala', },
            {name: 'Min',},
            {name: 'Max', },
            {name: 'Scale',},
          ],
          rows: [
            ['Baik', 0,50,'Good'],
            ['Sedang', 51,100,'Moderate'],
            ['Tidak Sehat', 101,200,'Unhealthy'],
            ['Sangat Tidak Sehat', 201,301,'Very Unhealthy'],
            ['Berbahay', 301,null,'Dangerous'],
          ],
        });
        worksheet.addTable({
          name: 'MyTable3',
          ref: `B${a.length + 23}`,
          headerRow: true,
          // totalsRow: true,
          style: {
            theme: 'TableStyleMedium6',
            // showRowStripes: true,
          },
          columns: [
            {name: 'Date', },
            {name: 'Ispu',},
            {name: 'Ispu value',},
            {name: 'Description', },
            {name: 'start date',},
            {name: 'end date',},
          ],
          rows: c
        });
        try {
          await workbook.xlsx.writeFile(`${path}/${moment().unix()}.xlsx`)
          // await workbook.xlsx.writeFile(`${path}/users.xlsx`)
          .then(() => {
            return response.json({
              status: "success",
              message: "file successfully created",
              path: `report/${moment().unix()}.xlsx`,
              });
          });
        } catch (err) {
          return response.status(400).send({
            status: "error",
            message: `Something went wrong ${err.message}`,
          });
        }
    }else{
      return response.status(400).send({status:'error',data:[],message:'data not available'})
    }
    
    function getMin(data){
      for (const iterator of data) {
        if (iterator===undefined || iterator === null) {
          data = []
        }
        break;
      }
      return data.length >= 1 ? Math.min(...data) : null
    }
    function getMax(data){
      for (const iterator of data) {
        if (iterator===undefined || iterator === null ) {
          data = []
        }
        break;
      }
      return data.length >= 1 ? Math.max(...data) : null
    }
    function getMean(data){
      for (const iterator of data) {
        if (iterator===undefined || iterator === null ) {
          data = []
        }
        break;
      }
      return data.length >= 1 ? (data.reduce((a, b) => a + b, 0) / data.length).toFixed(1) : null
    }
  }

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function HitungIspu(data){
  var res = []
  if (data[0]) {
    const ispuConst = await Database.from('ispu_const').where({ iot_parameter_id: data[1]}).where('xax','>',data[0]).limit(1)
    const hasil = ((ispuConst[0].ia-ispuConst[0].ib)/(ispuConst[0].xa-ispuConst[0].xb)*(data[0]-ispuConst[0].xb))+ ispuConst[0].ib
    res = [hasil.toFixed(),ispuConst[0]]
  }else{
    res = [null,null]
  }
  return res
}

module.exports = AirpointerController
