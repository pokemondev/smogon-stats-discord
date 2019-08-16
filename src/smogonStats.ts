import fs = require("fs");

export class SmogonStats {
  
  private leads: [];
  
  constructor() {
    this.leads = [];
  }
  
  getLeads(format = 'gen7ou') {
    if (!this.leads[format]) {
      const data = this.loadFileData('leads', format); 
      this.leads[format] = data.data.rows.slice(0, 10);
    }

    return this.leads[format].map(mon => { return { name: mon[1], usage: mon[2] }});
  }

  loadFileData(statsType, format = '') {
    const rawdata = fs.readFileSync(`data/smogon-stats/${statsType}-${format}.json`).toString();
    return JSON.parse(rawdata);
  }
}
//module.exports = SmogonStats