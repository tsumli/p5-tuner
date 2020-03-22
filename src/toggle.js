import React from 'react';
function alter_button(s1,s2,s3,st){
    if (st === 2) {
        return s1;
    }else if(st === 1){
        return s2;
    }else if(st === 0){
        return s3;
    }
}

export default class Toggle extends React.Component {
    constructor(props){
        super();
    }
    render(){
        return(
            <div className="control_buttons">
                <div id="nineth" className="toggle" onClick={this.props.alteredClick}>
                    {(()=>{
                        return alter_button("9","b9","OFF",this.props.altereds[9])
                    })()}
                </div>
                <div id="third" className="toggle" onClick={this.props.alteredClick}>
                {(()=>{
                    return alter_button("M3","m3","OFF",this.props.altereds[3])
                })()}
                </div>
                <div id="fourth" className="toggle" onClick={this.props.alteredClick}>
                    {(()=>{
                        return alter_button("#11","11","OFF",this.props.altereds[11])
                    })()}
                </div>
                <div id="fifth" className="toggle" onClick={this.props.alteredClick}>
                    {(()=>{
                        return alter_button("#5","5","OFF",this.props.altereds[5])
                    })()}
                </div>
                <div id="sixth" className="toggle" onClick={this.props.alteredClick}>
                    {(()=>{
                        return alter_button("13","b13","OFF",this.props.altereds[13])
                    })()}
                </div>
                <div id="seventh" className="toggle" onClick={this.props.alteredClick}>
                    {(()=>{
                        return alter_button("M7","m7","OFF",this.props.altereds[7])
                    })()}
                </div>
            </div>
        );
    }
}