
import React from 'react';
import './button.css';
var notes = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"]

export default class Note extends React.Component {
    constructor(props){
        super();
    }
    render(){
        const note_all=[]
        for(var idx in notes){
            note_all.push(
                <div id={notes[idx]} className="note_button" onClick={this.props.noteClick}>
                    {notes[idx]}
                </div>
            )
        } 
        return(
            <div　className="note_buttons">
                <div className="stop_button" onClick={this.props.stopClick}>
                    Stop
                </div>
                {note_all}
            </div>
        );
    }
}
