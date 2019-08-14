const fs = require("fs");

class SmogonStats {

    constructor() {
        this._leads = [];
     }
    
    leads(format = 'gen7ou') {
        if (!this._leads[format]) {
            const data = this.loadFileData('leads', format); 
            this._leads[format] = data.data.rows.slice(0, 10);
        }

        return this._leads[format].map(mon => { return { name: mon[1], usage: mon[2] }});
    }

    loadFileData(statsType, format = '') {
        let rawdata = fs.readFileSync(`data/smogon-stats/${statsType}-${format}.json`);
        return JSON.parse(rawdata);
    }
}
module.exports = SmogonStats