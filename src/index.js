import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Note from './button';
import StateDisplay from './state_display';
import HerzOct from './herz_oct';
import Toggle from './toggle';
import Tone from 'tone';
var note_freq_dic = {
    "Bb":2**(1/12)*2,
    "A": 2,
    "B": 2**(2/12)*2,
    "C": 2**(3/12),
    "Db":  2**(4/12),
    "D":  2**(5/12),
    "Eb":  2**(6/12),
    "E": 2**(7/12),
    "F":  2**(8/12),
    "Gb":  2**(9/12),
    "G":  2**(10/12),
    "Ab":  2**(11/12),
    "Stop":0,
    "None":0,
};
var altereds_freq_dic = {
    9:{0:0,1:16/15*2,2:9/8*2},
    3:{0:0,1:6/5,2:5/4},
    11:{0:0,1:4/3*2,2:45/32*2},
    5:{0:0,1:3/2,2:8/5},
    13:{0:0,1:8/5*2,2:5/3*2},
    7:{0:0,1:16/9,2:15/8},
}
var a=[]
for(let i=0;i<10;i++){
    a.push(new Tone.Oscillator().toMaster())
}
var osc = {
    1:a[0],
    9:a[1],
    3:a[2],
    11:a[3],
    5:a[4],
    13:a[5],
    7:a[6],
    8:a[7],
}

osc[1].volume.value = -22;
osc[8].volume.value = -39;
osc[5].volume.value = -19;
osc[3].volume.value = -23;
osc[7].volume.value = -23;
osc[13].volume.value = -27;
osc[9].volume.value = -27;
osc[11].volume.value = -27;

function note_play(){
    for(var item in osc){
        osc[item].start()
    }
}

function note_stop(){
    for(var item in osc){
        osc[item].stop();
    }
}

class App extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            sounding_note:"None",
            hz:440,
            oct:3,
            freq:0,
            isPlaying:false,
            altereds:{9:0,3:0,11:0,5:0,13:0,7:0}
        };
    }
    stopClick = () => {
        note_stop()
        this.setState({isPlaying:false})
        this.setState({sounding_note:"Stop"})
        this.setState({freq:0})
    }
    
    note_set(freq=this.state.freq,altereds=this.state.altereds){
        osc[1].frequency.value = freq;
        osc[8].frequency.value = freq/2;
        for(let item in altereds){
            let idx = altereds[item]
            osc[item].frequency.value = freq*altereds_freq_dic[item][idx]
        }
    }
    freq_set(input=this.state.sounding_note,hz=this.state.hz,oct=this.state.oct){
        return note_freq_dic[input]*hz*2**(oct-4)
    }
    octClick = (props) => {
        const input = props.currentTarget.id
        let oct = this.state.oct
        if(input==='octup'){
            oct+=1
        }else{
            oct-=1
        }
        if(oct>8){
            oct=8
        }else if(oct<0){
            oct=0
        }
        this.setState({oct:oct},()=>{
            let freq = this.freq_set()
            this.setState({freq:freq},()=>{ 
                this.note_set()
            })
        })
    }
    hzClick = (props) => {
        const input = props.currentTarget.id
        let herz=this.state.hz;
        if(input==='Hzup'){
            herz+=1;
        }else{
            herz-=1;
        }
        if(herz>480){
            herz=480
        }else if(herz<400){
            herz=400
        }
        this.setState({hz:herz},()=>{
            let freq = this.freq_set()
            this.setState({freq:freq},()=>{
                this.note_set()
            })
        })
    }

    noteClick =(props) =>{
        const input = props.currentTarget.id
        this.setState({sounding_note:input})
        if(!this.state.isPlaying){
            this.setState({isPlaying:true})
            let freq = this.freq_set(input)
            this.setState({freq:freq},()=>{
                this.note_set()
                note_play()
            })
        }if(this.state.isPlaying){
            let freq = this.freq_set(input)
            this.setState({freq:freq},()=>{
                this.note_set()    
            })
        }
    }

    alteredClick = (props) => {
        const input = props.currentTarget.id
        let mp = {'third':3,'seventh':7,'sixth':13,'fifth':5,'nineth':9,'fourth':11}
        let map = this.state.altereds
        let tmp = (map[mp[input]] + 1)%3
        map[mp[input]] = tmp;
        this.setState({altereds:map},()=>{
            this.note_set();
        })
    }
    render(){
        return(
            <div　className="app_all">
                <h1 className="title" >p5-tuner</h1>
                <StateDisplay note={this.state.sounding_note} freq={this.state.freq}></StateDisplay>
                <Note stopClick={this.stopClick} noteClick={this.noteClick}></Note>
                <Toggle alteredClick={this.alteredClick}
                        altereds={this.state.altereds}
                        note_set = {this.note_set}
                ></Toggle>
                <HerzOct    octClick = {this.octClick} 
                            hzClick = {this.hzClick}
                            hz = {this.state.hz}
                            oct = {this.state.oct}
                            note_set = {this.note_set}
                            freq_set = {this.freq_set}
                ></HerzOct>
                <div className="app_text">
                </div>
            </div>
        );
    }
}


// ========================================

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
