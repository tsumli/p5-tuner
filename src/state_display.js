
import React from 'react';

export default class StateDisplay extends React.Component {
    constructor(props){
        super()
    }
    render(){
        return(
            <div className="sounding_note" >
                {this.props.note}:{Math.round(this.props.freq*Math.pow(10,2))/Math.pow(10,2)}Hz
            </div>
        );
    }

}