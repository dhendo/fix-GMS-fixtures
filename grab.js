import fetch from 'node-fetch';
import {createRequire} from 'module';

const require = createRequire(import.meta.url);
import * as XLSX from "xlsx";

var key;
var matchDays = [], fixtures = [];
var club_guid;

async function extractFixtures(matchDay) {
    for(let i = 0; i < matchDay.competitions.length; i++) {
        const competition = matchDay.competitions[i];
        for(let j = 0; j < competition.fixtures.length; j++) {
            const jfixture = competition.fixtures[j];
            let fixture = {
                "Venue": jfixture.venue,
                "Date": jfixture.fixtureDate.split("T")[0],
                "Competition": jfixture.competitionName,
                "Time": jfixture.fixtureTime,
            };

            let splDate = fixture["Date"].split("-");
            fixture["Date"] = [splDate[2], splDate[1], splDate[0]].join("-");
            if(jfixture.homeTeam.clubId === club_guid) {
                fixture["Home/Away"] = "H"
                fixture["My Team"] = jfixture.homeTeam.teamName + " (" + jfixture.homeTeam.gender +")";
                fixture["Opposition"] = jfixture.awayTeam.teamName;
            } else {
                fixture["Home/Away"] = "A"
                fixture["My Team"] = jfixture.awayTeam.teamName + " (" + jfixture.awayTeam.gender +")";
                fixture["Opposition"] = jfixture.homeTeam.teamName;
            }

            fixtures.push(fixture);

        }

    }

}

async function writeOut(infixtures) {
    let ws = XLSX.utils.json_to_sheet(infixtures);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "sheet");
    // let buf = XLSX.write(wb, {bookType:'xlsx', type:'buffer'}); // generate a nodejs buffer
    let str = XLSX.write(wb, {bookType: 'xlsx', type: 'binary'}); // generate a binary string in web browser
    XLSX.writeFile(wb, `cleaned_fixtures.xlsx`);
}

async function get(club_id, day, min_date) {
    var resp = await fetch(`https://southcentral.englandhockey.co.uk/clubs/${club_id}`)
    let html = await resp.text();
    let tag = /data\-module="competitions(.*?)\>/
    var res = tag.exec(html);
    if(res && res[1]) {
        let match = res[1];
        key = /url\-key="(.*?)"/.exec(match)[1];
        var url = /data\-url="(.*?)"/.exec(match)[1];
        club_guid = /\/clubs\/(.*?)\//.exec(url)[1];
        resp = await fetch(url, {headers: {"x-functions-key": key}})
        var json = await resp.json()

        var ids = []
        for(let i = 0; i < json.matchDays.length; i++) {
            const matchDay = json.matchDays[i];

            var d = new Date(matchDay.id);
            if(d.getDay() === day && d > min_date) {
                if(matchDay.competitions) {
                    matchDays.push(matchDay);
                } else {
                    ids.push(matchDay.links[0].href);
                }
            }
        }
    }

    if(ids.length) {
        for(let i = 0; i < ids.length; i++) {
            await getMatchDay(ids[i]);
        }
    }

    for(let i = 0; i < matchDays.length; i++) {
        const matchDay = matchDays[i];
        extractFixtures(matchDay);
    }

    writeOut(fixtures);

}

async function getMatchDay(url) {
    let resp = await fetch(url, {headers: {"x-functions-key": key}})
    var json = await resp.json()
    matchDays.push({competitions: json});

}

get("trojans-hc", 6, new Date("2023-09-01"));
