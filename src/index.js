import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
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
var osc= new Tone.Oscillator().toMaster();
var osc_5 = new Tone.Oscillator().toMaster();
var osc_8vb = new Tone.Oscillator().toMaster();
var osc_3 = new Tone.Oscillator().toMaster();
var osc_7 = new Tone.Oscillator().toMaster();
var osc_6 = new Tone.Oscillator().toMaster();
var osc_4 = new Tone.Oscillator().toMaster();
var osc_9 = new Tone.Oscillator().toMaster();
var dist = new Tone.Distortion(0.3).toMaster();
osc.connect(dist);
osc.volume.value = -24;
osc_8vb.volume.value = -39;
osc_5.volume.value = -19;
osc_3.volume.value = -23;
osc_7.volume.value = -23;
osc_6.volume.value = -27;
osc_9.volume.value = -27;
osc_4.volume.value = -27;

function note_play(){
    osc.start();
    osc_5.start();
    osc_8vb.start();
    osc_3.start();
    osc_7.start();
    osc_9.start();
    osc_6.start();
    osc_4.start();
}

function note_set(freq,third,seventh,nineth,fourth,sixth,fifth){
    osc.frequency.value = freq;
    osc_8vb.frequency.value = freq/2;
    switch(third){
        case 0:
            osc_3.frequency.value = 0;
            break;
        case 1:
            osc_3.frequency.value = freq*6/5;
            break;
        case 2:
            osc_3.frequency.value = freq*5/4;
            break;
        default:
            console.debug("third error");
            break;
    }
    switch(fifth){
        case 0:
            osc_5.frequency.value = 0;
            break;
        case 1:
            osc_5.frequency.value = freq*3/2;
            break;
        case 2:
            osc_5.frequency.value = freq*8/5;
            break;
        default:
            console.debug("fifth error");
            break;
    }
    switch(seventh){
        case 0:
            osc_7.frequency.value = 0;
            break;
        case 1:
            osc_7.frequency.value = freq*16/9;
            break;
        case 2:
            osc_7.frequency.value = freq*15/8;
            break;
        default:
            console.debug("seventh error");
            break;
    }
    switch(nineth){
        case 0:
            osc_9.frequency.value = 0;
            break;
        case 1:
            osc_9.frequency.value = freq*16/15*2;
            break;
        case 2:
            osc_9.frequency.value = freq*9/8*2;
            break;
        default:
            console.debug("nineth error");
            break;
    }
    switch(fourth){
        case 0:
            osc_4.frequency.value = 0;
            break;
        case 1:
            osc_4.frequency.value = freq*4/3*2;
            break;
        case 2:
            osc_4.frequency.value = freq*45/32*2;
            break;
        default:
            console.debug("fourth error");
            break;
    }
    switch(sixth){
        case 0:
            osc_6.frequency.value = 0;
            break;
        case 1:
            osc_6.frequency.value = freq*8/5*2;
            break;
        case 2:
            osc_6.frequency.value = freq*5/3*2;
            break;
        default:
            console.debug("sixth error");
            break;
    }
}

function note_stop(){
    osc.stop();
    osc_5.stop();
    osc_8vb.stop();
    osc_3.stop();
    osc_7.stop();
    osc_6.stop();
    osc_9.stop();
    osc_4.stop();
}
function freq_set(input,hz,oct){
    return note_freq_dic[input]*hz*2**(oct-4)
}

function alter_button(s1,s2,s3,st){
    if (st === 2) {
        return s1;
    }else if(st === 1){
        return s2;
    }else if(st === 0){
        return s3;
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
            third:0,
            seventh:0,
            nineth:0,
            fourth:0,
            sixth:0,
            fifth:0,
        };
    }
    stopClick = (props) => {
        note_stop()
        this.setState({isPlaying:false})
        this.setState({sounding_note:"Stop"})
        this.setState({freq:0})
    }
    hzClick = (props) => {
        const input = props.currentTarget.id
        switch(input){
            case 'Hzup':{
                let herz = this.state.hz + 1
                if(herz>480){
                    herz=480
                }
                this.setState({hz:herz})
                let freq = freq_set(this.state.sounding_note,herz,this.state.oct)
                this.setState({freq:freq})
                note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
                break;
            }
            case 'Hzdown':{
                let herz = this.state.hz - 1
                if(herz<400){
                    herz=400
                }
                this.setState({hz:herz})
                let freq = freq_set(this.state.sounding_note,herz,this.state.oct)
                this.setState({freq:freq})
                note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
                break;
            }
            default:
                break;
        }
    }
    octClick = (props) => {
        const input = props.currentTarget.id
        switch(input){
            case 'octup':{
                let oct = this.state.oct + 1
                if(oct>8){
                    oct=8
                }
                this.setState({oct:oct})
                let freq = freq_set(this.state.sounding_note,this.state.hz,oct)
                this.setState({freq:freq})
                note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
                break;
            }
            case 'octdown':{
                let oct = this.state.oct - 1
                if(oct<0){
                    oct=0
                }
                this.setState({oct:oct})
                let freq = freq_set(this.state.sounding_note,this.state.hz,oct)
                this.setState({freq:freq})
                note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
                break;
            }
            default:
                break;
        }
    }

    noteClick =(props) =>{
        const input = props.currentTarget.id
        this.setState({sounding_note:input})
        if(!this.state.isPlaying){
            this.setState({isPlaying:true})
            let freq = freq_set(input,this.state.hz,this.state.oct)
            this.setState({freq:freq})
            note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
            note_play()
        }if(this.state.isPlaying){
            let freq = freq_set(input,this.state.hz,this.state.oct)
            this.setState({freq:freq})
            note_set(freq,this.state.third,this.state.seventh,this.state.nineth,this.state.fourth,this.state.sixth,this.state.fifth)
        }
    }
    handleClick = (props) => {
        const input = props.currentTarget.id
        switch(input){
            case 'third':{
                let third = (this.state.third + 1)%3
                this.setState({third:third})
                switch(third){
                    case 0:
                        osc_3.frequency.value = 0
                        break;
                    case 1:
                        osc_3.frequency.value = this.state.freq*6/5
                        break;
                    case 2:
                        osc_3.frequency.value = this.state.freq*5/4
                        // osc_3.frequency.value = this.state.freq*2**(4/12)
                        break;
                    default:
                        break;
                }
                break;
            }
            case 'seventh':{
                let seventh = (this.state.seventh + 1)%3
                this.setState({seventh:seventh})
                switch(seventh){
                    case 0:
                        osc_7.frequency.value = 0
                        break;
                    case 1:
                        osc_7.frequency.value = this.state.freq*16/9
                        break;
                    case 2:
                        osc_7.frequency.value = this.state.freq*15/8
                        // osc_7.frequency.value = this.state.freq*2**(11/12)
                        break;
                    default:
                        break;
                }
                break;
            }
            case 'sixth':{
                let sixth = (this.state.sixth + 1)%3
                this.setState({sixth:sixth})
                switch(sixth){
                    case 0:
                        osc_6.frequency.value = 0
                        break;
                    case 1:
                        osc_6.frequency.value = this.state.freq*8/5*2
                        break;
                    case 2:
                        osc_6.frequency.value = this.state.freq*5/3*2
                        break;
                    default:
                        break;
                }
                break;
            }
            case 'fifth':{
                let fifth = (this.state.fifth + 1)%3
                this.setState({fifth:fifth})
                switch(fifth){
                    case 0:
                        osc_5.frequency.value = 0
                        break;
                    case 1:
                        osc_5.frequency.value = this.state.freq*3/2
                        break;
                    case 2:
                        osc_5.frequency.value = this.state.freq*8/5
                        break;
                    default:
                        break;
                }
                break;
            }
            case 'nineth':{
                let nineth = (this.state.nineth + 1)%3
                this.setState({nineth:nineth})
                switch(nineth){
                    case 0:
                        osc_9.frequency.value = 0
                        break;
                    case 1:
                        osc_9.frequency.value = this.state.freq*16/15*2
                        break;
                    case 2:
                        osc_9.frequency.value = this.state.freq*9/8*2
                        break;
                    default:
                        console.debug("error nineth")
                }
                break;
            }
            case 'fourth':{
                let fourth = (this.state.fourth + 1)%3
                this.setState({fourth:fourth})
                switch(fourth){
                    case 0:
                        osc_4.frequency.value = 0
                        break;
                    case 1:
                        osc_4.frequency.value = this.state.freq*4/3*2
                        break;
                    case 2:
                        osc_4.frequency.value = this.state.freq*45/32*2
                        break;
                    default:
                        break;
                }
                break;
            }
            default:{
                break;
            }
        }
    }
    render(){
        return(
            <div　className="app_all">
                <h1 className="title" >p5-tuner</h1>
                <div className="sounding_note" >
                    {this.state.sounding_note}:{Math.round(this.state.freq*Math.pow(10,2))/Math.pow(10,2)}Hz
                </div>

                <div　className="note_buttons">
                    <div className="stop_button" onClick={this.stopClick}>
                        Stop
                    </div>
                    <div id="C" className="note_button" onClick={this.noteClick}>
                        C
                    </div>
                    <div id="Db" className="note_button" onClick={this.noteClick}>
                        Db
                    </div>
                    <div id="D" className="note_button" onClick={this.noteClick}>
                        D
                    </div>
                    <div id="Eb" className="note_button" onClick={this.noteClick}>
                        Eb
                    </div>
                    <div id="E" className="note_button" onClick={this.noteClick}>
                        E
                    </div>
                    <div id="F" className="note_button" onClick={this.noteClick}>
                        F
                    </div>
                    <div id="Gb" className="note_button" onClick={this.noteClick}>
                        Gb
                    </div>
                    <div id="G" className="note_button" onClick={this.noteClick}>
                        G
                    </div>
                    <div id="Ab" className="note_button" onClick={this.noteClick}>
                        Ab
                    </div>
                    <div id="A" className="note_button" onClick={this.noteClick}>
                        A
                    </div>
                    <div id="Bb" className="note_button" onClick={this.noteClick}>
                        Bb
                    </div>
                    <div id="B" className="note_button" onClick={this.noteClick}>
                        B
                    </div>
                </div>
                <div className="control_buttons">
                    <div id="nineth" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("9","b9","OFF",this.state.nineth)
                        })()}
                    </div>
                    <div id="third" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("M3","m3","OFF",this.state.third)
                        })()}
                    </div>
                    <div id="fourth" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("#11","11","OFF",this.state.fourth)
                        })()}
                    </div>
                    <div id="fifth" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("#5","5","OFF",this.state.fifth)
                        })()}
                    </div>
                    <div id="sixth" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("13","b13","OFF",this.state.sixth)
                        })()}
                    </div>
                    <div id="seventh" className="toggle" onClick={this.handleClick}>
                        {(()=>{
                            return alter_button("M7","m7","OFF",this.state.seventh)
                        })()}
                    </div>
                </div>
                <div className="herz_oct">
                    <div className="oct_buttons">
                        <div id="octup" className="uptriangle" onClick={this.octClick}>
                        </div>
                        <div className="herz_name">
                            Octave:{this.state.oct}
                        </div>
                        <div id="octdown" className="downtriangle" onClick={this.octClick}>
                        </div>
                    </div>
                    <div className="herz_buttons">
                        <div id="Hzup" className="uptriangle" onClick={this.hzClick}>
                        </div>
                        <div className="herz_name">
                            A:{this.state.hz}Hz
                        </div>
                        <div id="Hzdown" className="downtriangle" onClick={this.hzClick}>
                        </div>
                    </div>
                </div>
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
